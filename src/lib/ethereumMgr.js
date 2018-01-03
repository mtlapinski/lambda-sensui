import networks from './networks'
import Web3 from 'web3'
import Promise from 'bluebird'
import { generators, signers } from 'eth-signer'
import Transaction from 'ethereumjs-tx'


import { Client } from 'pg'

const HDSigner = signers.HDSigner

const DEFAULT_GAS_PRICE = 20000000000 // 20 Gwei

class EthereumMgr {

  constructor() {
    this.pgUrl=null
    this.seed=null

    this.web3s = {}
    
    this.gasPrice = DEFAULT_GAS_PRICE

    for (const network in networks) {
      let provider = new Web3.providers.HttpProvider(networks[network].rpcUrl)
      let web3 = new Web3(provider)
      web3.eth = Promise.promisifyAll(web3.eth)
      this.web3s[network] = web3
    }
  }

  isSecretsSet(){
      return (this.pgUrl !== null || this.seed !== null);
  }

  setSecrets(secrets){
      this.pgUrl=secrets.PG_URL;
      this.seed=secrets.SEED;
  
      const hdPrivKey = generators.Phrase.toHDPrivateKey(this.seed)
      this.signer = new HDSigner(hdPrivKey)
  
  }

  getProvider(networkName) {
    return this.web3s[networkName].currentProvider
  }  

  async getBalance(address, networkName) {
    return await this.web3s[networkName].eth.getBalanceAsync(address)
  }

  async getGasPrice(networkName) {
    try {
      this.gasPrice = (await this.web3s[networkName].eth.getGasPriceAsync()).toNumber()
    } catch (e) {
      console.log(e)
    }
    return this.gasPrice
  }

  async getNonce(address, networkName) {
    if(!address) throw('no address')    
    if(!networkName) throw('no networkName')    
    if(!this.pgUrl) throw('no pgUrl set')

    const client = new Client({
        connectionString: this.pgUrl,
    })

    try{
        await client.connect()
        const res=await client.query(
            "INSERT INTO nonces(address,network,nonce) \
             VALUES ($1,$2,0) \
        ON CONFLICT (address,network) DO UPDATE \
              SET nonce = nonces.nonce + 1 \
            WHERE nonces.address=$1 \
              AND nonces.network=$2 \
        RETURNING nonce;"
            , [address, networkName]);
        return res.rows[0].nonce;
    } catch (e){
        throw(e);
    } finally {
        await client.end()
    }
  }
 

  async signTx({txHex, blockchain}) {
    let tx = new Transaction(Buffer.from(txHex, 'hex'))
    // TODO - set correct gas Limit
    tx.gasLimit = 3000000
    tx.gasPrice = await this.getGasPrice(blockchain)
    tx.nonce = await this.getNonce(this.signer.getAddress(), blockchain)
    
    const rawTx = tx.serialize().toString('hex')
    return new Promise((resolve, reject) => {
      this.signer.signRawTx(rawTx, (error, signedRawTx) => {
        if (error) {
          reject(error)
        }
        resolve(signedRawTx)
      })
    })
  }

  async sendRawTransaction(signedRawTx, networkName) {
    if (!signedRawTx.startsWith('0x')) {
      signedRawTx= '0x'+signedRawTx
    }
    return await this.web3s[networkName].eth.sendRawTransactionAsync(signedRawTx)
  }
 
}

module.exports = EthereumMgr
