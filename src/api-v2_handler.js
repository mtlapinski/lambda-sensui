'use strict'

const RelayHandler = require('./api-v2/relay')
const EthereumMgr = require('./lib/ethereumMgr')

const SEED = 'actual winner member hen nose buddy strong ball stove supply stick acquire'

let ethereumMgr = new EthereumMgr(process.env.PG_URL)

let relayHandler = new RelayHandler(ethereumMgr, SEED)

module.exports.relay = (event, context, callback) => {
  let response
  relayHandler.handle(event).then(res => {
    response = {
      statusCode: 200,
      body: {
        status: 'success',
        txHash: res
      }
    }
  }).catch(error => {
    let statusCode = error.code ? error.code : 500
    let message = error.message ? error.message : error
    response = {
      statusCode,
      body: {
        status: 'error',
        message
      }
    }
  }).then(() => {
    callback(null, response)
  })
}