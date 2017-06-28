const test = require('tape')
const osmdb = require('osm-p2p-mem')
const memdb = require('memdb')
const OBS = require('osm-p2p-observations')
const fs = require('fs')
const path = require('path')

const ObserveExport = require('../')

const osmOrgDb = osmdb()
const obsDb = osmdb()
const obsIndex = OBS({ db: memdb(), log: obsDb.log })
const obsDbFixture = require('./fixtures/obs_db_import.json')
const osmOrgDbFixture = require('./fixtures/osm_org_db_import.json')
let snapshot = false

if (process.argv[2] === 'snapshot') {
  snapshot = true
}

const snapshotDir = path.join(__dirname, 'fixtures')
function writeSnapshot (filename, data) {
  fs.writeFileSync(path.join(snapshotDir, filename), JSON.stringify(data, null, 2))
}

test('Populate db with fixture', function (t) {
  t.plan(3)

  obsDb.batch(obsDbFixture, function (err, nodes) {
    t.error(err)
    obsIndex.ready(function () {
      t.pass()
    })
  })

  osmOrgDb.batch(osmOrgDbFixture, function (err, nodes) {
    t.error(err)
  })
})

test('Export observations as OSM JSON', function (t) {
  const obsExport = new ObserveExport(osmOrgDb, obsDb, obsIndex)
  const ids = ['5376464111285135', '3698308318298018']
  const expected = require('./fixtures/observations.json')

  obsExport.osmJson(ids, function (err, observations) {
    if (snapshot) writeSnapshot('observations.json', observations)
    t.error(err)
    t.deepEqual(observations, expected)
    t.end()
  })
})

test('Export new nodes as OSM JSON with observations', function (t) {
  const obsExport = new ObserveExport(osmOrgDb, obsDb, obsIndex)
  const ids = ['5376464111285135', '3698308318298018']
  const expected = require('./fixtures/with_nodes.json')
  const opts = {linkedNodes: true}

  obsExport.osmJson(ids, opts, function (err, entities) {
    t.error(err)
    if (snapshot) writeSnapshot('with_nodes.json', entities)
    t.deepEqual(entities, expected)
    t.end()
  })
})

test('Export OSM ChangeJson', function (t) {
  const obsExport = new ObserveExport(osmOrgDb, obsDb, obsIndex)
  const ids = ['5376464111285135', '3698308318298018']
  const expected = require('./fixtures/osm_change.json')

  obsExport.osmChangeJson(ids, function (err, osmChange) {
    t.error(err)
    if (snapshot) writeSnapshot('osm_change.json', osmChange)
    t.deepEqual(osmChange, expected)
    t.end()
  })
})

test('Export OSM ChangeXml', function (t) {
  const obsExport = new ObserveExport(osmOrgDb, obsDb, obsIndex)
  const ids = ['5376464111285135', '3698308318298018']
  const expected = fs.readFileSync(path.join(snapshotDir, 'change.osm'), 'utf8')

  obsExport.osmChangeXml(ids, function (err, xml) {
    t.error(err)
    if (snapshot) fs.writeFileSync(path.join(snapshotDir, 'change.osm'), xml)
    t.equal(xml, expected)
    t.end()
  })
})


function cmp (a, b) { return a.id < b.id ? -1 : 1 }
function isObs (doc) { return doc.type === 'observation' }
function valueof (doc) { return doc.value }
function vprop (doc) { return doc.v }
