const once = require('once')
const createApi = require('osm-p2p-server/api')

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

function values (o) { return Object.keys(o).map(k => o[k]) }
function latest (forks) { return forks.sort(cmpFork)[0] }
function valueOf (doc) { return doc.value }
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
