const osmdb = require('osm-p2p-mem')
const osm = osmdb()

if (process.argv[2] === 'create') {
  var value = JSON.parse(process.argv[3])
  osm.create(value, function (err, key, node) {
    if (err) console.error(err)
    else console.log(key)
  })
} else if (process.argv[2] === 'get') {
  value = JSON.parse(process.argv[3])
  osm.get(value, function (err, docs) {
    if (err) console.error(err)
    else console.log(docs)
  })
}
