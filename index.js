const once = require('once')
const createApi = require('osm-p2p-server/api')
const from = require('from2-array')
const collect = require('collect-stream')
const toOsmXml = require('obj2osm')
const omit = require('lodash/omit')

const assign = Object.assign

module.exports = ObserveExport

/**
 * Create an object for export of data from an Observe database
 * @param {osm-p2p-db} osmOrgDb  An osm-p2p-db instance with existing nodes from osm.org
 * @param {osm-p2p-db} obsDb     An osm-p2p-db instance with observations and any newly created nodes
 * @param {osm-p2p-observations} obsIndex An osm-p2p-observations instance with links between observations and nodes
 */
function ObserveExport (osmOrgDb, obsDb, obsIndex) {
  if (!(this instanceof ObserveExport)) return new ObserveExport(osmOrgDb, obsDb, obsIndex)
  this.obsIndex = obsIndex
  this.apiOsm = createApi(osmOrgDb)
  this.apiObs = createApi(obsDb)
}

/**
 * Given a list of OSM IDs of 'observation'-type documents, return a mapping of
 * these IDs to the actual observation documents, with a 'links' property added
 * to each document, that is a list of 'node' OSM IDs that the observation is
 * linked to.
 * If 'opts.linkedNodes' is truthy, the 'node' OSM documents that are linked to
 * will also be included in the results. The linked nodes can either be existing
 * osm.org nodes from the `osmOrgDb`, or newly created nodes from the `obsDb`
 * @param {String[]} observationOsmIds Array of string ids of osm-p2p-observations
 * @param {Object}   opts
 * @param {Boolean}  opts.linkedNodes  Include linked nodes in the export
 * @param {Function} cb                Called with an array of OSM documents
 * @return {undefined}
 */
ObserveExport.prototype.osmObjects = function (observationOsmIds, opts, cb) {
  if (arguments.length === 2 && typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  cb = once(cb)
  const self = this
  const observations = {}
  const observationLinks = []
  let result
  // x2 because two requests below for each observation
  let pending = observationOsmIds.length * 2

  observationOsmIds.forEach(id => {
    // Get the observation
    self.apiObs.getElement(id, onObservation)
    // Get any links
    self.obsIndex.links(id, onObsevationLinks)
  })

  function onObservation (err, forks) {
    if (err && err.name !== 'NotFoundError') return cb(err)
    // Merge any forks by selecting the most recent
    if (forks && forks.length) {
      const obs = latest(forks)
      observations[obs.id] = obs
    }
    done()
  }

  function onObsevationLinks (err, links) {
    if (err) return cb(err)
    if (!links.length) return done()
    // Use this push to avoid creating multiple arrays with `concat`
    // which would need to be garbage collected
    Array.prototype.push.apply(observationLinks, links.map(valueOf))
    done()
  }

  function done (err) {
    if (err) return cb(err)
    if (--pending > 0) return
    // Append the osm node ids in any links to the observation they link to
    observationLinks.forEach(link => {
      const obs = observations[link.obs]
      obs.links = obs.links || []
      obs.links.push(link.link)
    })
    result = values(observations)
    if (!opts.linkedNodes) return cb(null, result)

    pending = observationLinks.length * 2
    // Linked nodes could be in either db, so we check both
    observationLinks.forEach(link => {
      self.apiObs.getElement(link.link, onNode)
      self.apiOsm.getElement(link.link, onNode)
    })
  }

  function onNode (err, forks) {
    if (err && err.name !== 'NotFoundError') return cb(err)
    // Merge any forks by selecting the most recent
    if (forks && forks.length) {
      const node = latest(forks)
      result.push(node)
    }
    if (--pending > 0) return
    cb(null, result)
  }
}

/**
 * Export a osmChange document as an array of OSM objects.
 * Each object has the property `action` which is one of
 * `create|modify|delete`. Created nodes are nodes from the
 * observationDb with a negative (placeholder) id. Modified
 * nodes are constructed from the original node in the osmOrgDb
 * and then merging the tags from linked observations in
 * chronological order.
 * Created nodes also have their placeholder ids replaced with
 * an decremental index from `-1` - this is to avoid issues with
 * importing the osmChange document into existing tools since osm-p2p
 * ids can be > 64 bits.
 * Finally version numbers are stripped from created nodes, since
 * existing tools do not expect these.
 * @param {String[]}   observationOsmIds Array of string ids of osm-p2p-observations
 * @param {Object}   opts   No options yet
 * @param {Function} cb     Called with an array of OSM objects with an `action` property
 * @return {undefined}
 */
ObserveExport.prototype.osmChange = function (observationOsmIds, opts, cb) {
  if (arguments.length === 2 && typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  cb = once(cb)

  this.osmObjects(observationOsmIds, {linkedNodes: true}, flattenJson)

  // Called with both observations and linked nodes
  function flattenJson (err, entities) {
    if (err) return cb(err)
    // Create a temporary index of observations by id of the node
    // they link to
    const observationsByNode = entities.filter(isObs)
      .reduce((acc, obs) => {
        ;(obs.links || []).forEach(id => {
          acc[id] = acc[id] || []
          acc[id].push(obs)
        })
        return acc
      }, {})
    const created = []
    const modified = []

    // For each node in the export, look up the related observations, sort
    // in date order, most recent last, and merge the tags onto the original node
    entities.filter(isNode)
      .forEach(node => {
        const nodeObservations = observationsByNode[node.id]
        if (!nodeObservations || !nodeObservations.length) return
        const newTags = [node.tags]
          .concat(nodeObservations.sort(latestLast).map(tagsOf))
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

    created.forEach((node, i) => {
      // Replace placeholder ids with an incremental index to avoid 64bit issues
      // with other tools like JOSM
      node.id = '-' + (i + 1)
      // Strip the version number from created nodes
      created[i] = omit(node, 'version')
    })
    cb(null, created.concat(modified))
  }
}

/**
 * Export an [OsmChange XML document](http://wiki.openstreetmap.org/wiki/OsmChange)
 * for changes related to the observations with `ids` in the passed
 * `observationOsmIds` array. See docs for `osmChange` for more details
 * on the export process
 * @param {String[]}   observationOsmIds Array of string ids of osm-p2p-observations
 * @param {Object}   opts              No options yet
 * @param {Function} cb                Called with OsmChange XML document
 * @return {undefined}
 */
ObserveExport.prototype.osmChangeXml = function (observationOsmIds, opts, cb) {
  if (arguments.length === 2 && typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  cb = once(cb)
  this.osmChangeJson(observationOsmIds, opts, function (err, osmChange) {
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

// Sort function to sort forks by most recent first, or by version id
// if no timestamps are set
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

// Sort by most recent last, sorting by version numbers as a fallback to keep sort stable
function latestLast (a, b) {
  return -1 * cmpFork(a, b)
}
