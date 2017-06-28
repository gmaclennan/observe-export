const test = require('tape')
const osmdb = require('osm-p2p-mem')
const memdb = require('memdb')
const collect = require('collect-stream')
const OBS = require('osm-p2p-observations')
const omit = require('lodash/omit')
const fs = require('fs')
const path = require('path')
const assign = Object.assign

const ObserveExport = require('../')

const osm = osmdb()
const obs = OBS({ db: memdb(), log: osm.log })
const docs = require('./fixtures/import.json')
let snapshot = false

if (process.argv[2] === 'snapshot') {
  snapshot = true
}

function writeSnapshot (filename, data) {
  fs.writeFileSync(path.join(__dirname, 'fixtures', filename), JSON.stringify(data, null, 2))
}

test('Populate db with fixture', function (t) {
  osm.batch(docs, function (err, nodes) {
    t.error(err)
    obs.ready(function () {
      t.end()
    })
  })
})

test('Export observations as OSM JSON', function (t) {
  const obsExport = new ObserveExport(osm, obs)
  const ids = ['5376464111285135', '3698308318298018']

  obsExport.osmJson(ids, function (err, observations) {
    if (snapshot) writeSnapshot('observations.json', observations)
    t.error(err)
    const expected = require('./fixtures/observations.json')
    t.deepEqual(observations, expected)
    t.end()
  })
})

test('Export new nodes as OSM JSON with observations', function (t) {
  const obsExport = new ObserveExport(osm, obs)
  const ids = ['5376464111285135', '3698308318298018']

  const opts = {
    linkedNodes: true
  }

  obsExport.osmJson(ids, opts, function (err, entities) {
    t.error(err)
    if (snapshot) writeSnapshot('with_nodes.json', entities)
    const expected = require('./fixtures/with_nodes.json')
    t.deepEqual(entities, expected)
    t.end()
  })
})

function cmp (a, b) { return a.id < b.id ? -1 : 1 }
function isobs (doc) { return doc.type === 'observation' }
function valueof (doc) { return doc.value }
function vprop (doc) { return doc.v }
