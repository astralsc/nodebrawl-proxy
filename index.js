const net = require('net')
const { execSync } = require('child_process')
const os = require('os')
const server = new net.Server()
const config = require('./config.json')
const PORT = config.ProxyPort

server.on('connection', async (client) => {
  client.setNoDelay(true)

  client.log = function (text) {
    return console.log(`[LOG] >> ${text}`)
  }

  client.log('Client connected.')

  const remote = net.createConnection({
    host: config.ServerIP,
    port: config.ServerPort
  })

  remote.setNoDelay(true)

  client.on('data', async (packet) => {
    try {
      if (packet.length >= 7) {
        const len = packet.readUIntBE(2, 3)

        if (packet.length >= 7 + len) {
          const message = {
            id: packet.readUInt16BE(0),
            len: len,
            version: packet.readUInt16BE(5),
            payload: packet.slice(7, len),
            client,
          }

          client.log(`Gotcha ${message.id} client packet!`)
        }
      }

      // forward client to server
      remote.write(packet)

    } catch (err) {
      console.log(err)
    }
  })

  // forward server to client
  remote.on('data', (packet) => {
    const len = packet.readUIntBE(2, 3)

    if (packet.length >= 7 + len) {
      const message = {
        id: packet.readUInt16BE(0),
        len: len,
        version: packet.readUInt16BE(5),
        payload: packet.slice(7, len),
        client,
      }

      client.log(`Gotcha ${message.id} server packet!`)
    }

    client.write(packet)
  })

  client.on('end', async () => {
    client.log('Client disconnected.')
    remote.destroy()
  })

  remote.on('end', () => {
    client.destroy()
  })

  client.on('error', async error => {
    try {
      client.log('A wild error!')
      console.log(error)
      client.destroy()
      remote.destroy()
    } catch (e) { }
  })

  remote.on('error', (err) => {
    console.log(err)
    client.destroy()
  })
})

server.once('listening', () => console.log(`[SERVER] >> Proxy started on ${PORT} port!`))
server.listen(PORT)

process.on("uncaughtException", e => console.log(e))

process.on("unhandledRejection", e => console.log(e))

