const once = require('once')
const createApi = require('osm-p2p-server/api')
const from = require('from2-array')
const collect = require('collect-stream')
const toOsmXml = require('obj2Osm')

const assign = Object.assign

module.exports = ObserveExport

function ObserveExport (osmOrgDb, obsDb, obsIndex) {
  if (!(this instanceof ObserveExport)) return new ObserveExport(osmOrgDb, obsDb, obsIndex)
  this.obsIndex = obsIndex
  this.apiOsm = createApi(osmOrgDb)
  this.apiObs = createApi(obsDb)
}

const proto = ObserveExport.prototype

proto.osmJson = function (ids, opts, cb) {
  if (arguments.length === 2 && typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  cb = once(cb)
  const self = this
  const observations = {}
  const observationLinks = []
  let result
  let pending = ids.length * 2

  ids.forEach(id => {
    self.apiObs.getElement(id, onObs)
    self.obsIndex.links(id, onLinks)
  })

  function onObs (err, forks) {
    if (err && err.name !== 'NotFoundError') return cb(err)
    if (forks && forks.length) {
      const obs = latest(forks)
      observations[obs.id] = obs
    }
    done()
  }

  function onLinks (err, links) {
    if (err) return cb(err)
    if (!links.length) return done()
    Array.prototype.push.apply(observationLinks, links.map(valueOf))
    done()
  }

  function done (err) {
    if (err) return cb(err)
    if (--pending > 0) return
    observationLinks.forEach(link => {
      const obs = observations[link.obs]
      obs.links = obs.links || []
      obs.links.push(link.link)
    })
    result = values(observations)
    if (!opts.linkedNodes) return cb(null, result)

    pending = observationLinks.length * 2
    observationLinks.forEach(link => {
      self.apiObs.getElement(link.link, onNode)
      self.apiOsm.getElement(link.link, onNode)
    })
  }

  function onNode (err, forks) {
    if (err && err.name !== 'NotFoundError') return cb(err)
    if (forks && forks.length) {
      const node = latest(forks)
      result.push(node)
    }
    if (--pending > 0) return
    cb(null, result)
  }
}

proto.osmChangeJson = function (ids, opts, cb) {
  if (arguments.length === 2 && typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  cb = once(cb)
  const self = this

  self.osmJson(ids, {linkedNodes: true}, flattenJson)

  function flattenJson (err, osmJson) {
    if (err) return cb(err)
    const observationsByNode = osmJson.filter(isObs)
      .reduce((acc, obs) => {
        ;(obs.links || []).forEach(id => {
          acc[id] = acc[id] || []
          acc[id].push(obs)
        })
        return acc
      }, {})
    const created = []
    const modified = []

    osmJson.filter(isNode)
      .forEach(node => {
        const nodeObservations = observationsByNode[node.id]
        if (!nodeObservations || !nodeObservations.length) return
        const newTags = [node.tags]
          .concat(nodeObservations.sort(cmpFork).map(tagsOf))
        const newNode = assign({}, node, {
          tags: assign.apply(null, newTags)
        })
        if (hasPlaceholderId(newNode)) {
          newNode.action = 'create'
          created.push(newNode)
        } else {
          newNode.action = 'modify'
          modified.push(newNode)
        }
      })
    cb(null, created.concat(modified))
  }
}

proto.osmChangeXml = function (ids, opts, cb) {
  if (arguments.length === 2 && typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  cb = once(cb)
  this.osmChangeJson(ids, opts, function (err, osmChange) {
    if (err) return cb(err)
    const rs = from.obj(osmChange).pipe(toOsmXml())
    collect(rs, cb)
  })
}

function isNode (entity) { return entity.type === 'node' }
function isObs (entity) { return entity.type === 'observation' }
function values (o) { return Object.keys(o).map(k => o[k]) }
function latest (forks) { return forks.sort(cmpFork)[0] }
function valueOf (doc) { return doc.value }
function tagsOf (entity) { return entity.tags }
function hasPlaceholderId (entity) { return entity.id.charAt(0) === '-' }

/**
 * Sort function to sort forks by most recent first, or by version id
 * if no timestamps are set
 */
function cmpFork (a, b) {
  if (a.timestamp && b.timestamp) {
    if (a.timestamp > b.timestamp) return -1
    if (a.timestamp < b.timestamp) return 1
    return 0
  }
  if (a.timestamp) return -1
  if (b.timestamp) return 1
  // Ensure sorting is stable between requests
  return a.version < b.version ? -1 : 1
}
