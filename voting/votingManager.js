
const Web3 = require('web3')
var storage = require('./storage')

// Files
const abiJson = require('./abi.json')

// CONSTS
const UNIQUE_KEY = "address"
const infuraBaseAddress = 'wss://mainnet.infura.io/ws/v3/'
const contractAddress = '0x68d57c9a1c35f63e2c83ee8e49a64e9d70528d25'
const infuraKey = '632d65efbe704a61b3a04b85fb921298'
const voteEventName = 'Approval'
const startBlock = 7536553
const TO_GWEI_FACTOR = 1000000000000000000

const web3 = new Web3(new Web3.providers.WebsocketProvider(infuraBaseAddress + infuraKey))

// Singelthon
var srnContract = new web3.eth.Contract(abiJson, contractAddress);

const start = async function() {
  await calcResult(web3)

  // When we get a new vote, we should calc result again
  listenToVotes(web3)

  console.log(storage.fetchResult())
}

async function calcResult(web3) {
    return new Promise(async function(resolve, reject) {
        console.log("====getting all votes====")
        let votes = await getAllVotes(web3)
        console.log("====got "+votes.length+ " votes====")
        if (votes) {
            console.log("====remove duplicates====")
            let votingMap = votesToAddressVoteMap(votes)
            votingMap = removeDuplicates(votingMap, UNIQUE_KEY)
            console.log("====got "+votingMap.length+ " votes without duplications====")
            console.log("====fetch balance for each address====")
            let votersWithBalance = await fetchBalanceForVoters(web3, votingMap)
            console.log("====calc total balance of voters====")
            let totalBalanceSum = sumTotalBalanceOfVoters(votersWithBalance)
            console.log("====calc percent of each vote====")
            votersWithBalance = calcPercentOfBalance(votersWithBalance, totalBalanceSum);
            console.log("====count yes and save in var====")
            let res = votersWithBalance.filter(vote => vote.vote == 1).map(vote => vote.strength).reduce((a, b) => a + b)
            storage.saveResult(formatResult(res))
            resolve()
        } else {
            reject()
        }
    });
}

function listenToVotes(web3) {
    console.log("listening to votes")
    srnContract.once(voteEventName, {
      filter: {},
      fromBlock: 0,
  }, (error, event) => { calcResult(web3) })
}

async function getAllVotes(web3) {
    return new Promise(function(resolve, reject) {
        srnContract.getPastEvents(voteEventName, {
            filter: {},
            fromBlock: startBlock,
            toBlock: 'latest'
        }, (error, events) => { resolve(events) })
    });
}

function votesToAddressVoteMap(votes) {
    return votes.map(vote => {
        return { txHash:vote.transactionHash, address : vote.returnValues.owner, vote:getRandomVote()}
        });
}

function sumTotalBalanceOfVoters(votes) {
    return votes.map(vote => vote.balance).reduce((a, b) => a + b)
}

function calcPercentOfBalance(votes, totalBalance) {
    return votes.map(vote => {
        vote.strength = vote.balance / totalBalance
        return vote
    })
}

function fetchBalanceForVoters(web3, voters) {
    const promises = voters.map(async vote => {
        vote.balance = formatBalance(await getSRNBalanceForAddress(web3, vote.address))
        return vote;
    })

    return Promise.all(promises);
}

function getSRNBalanceForAddress(web3, address) {
    return srnContract.methods.balanceOf(address).call()
  }

// Utils
function getRandomVote() {
    return Math.round(Math.random())
}

function formatBalance(balance) {
    return parseInt(balance._hex, 16) / TO_GWEI_FACTOR;
}

function removeDuplicates(myArr, prop) {
    return myArr.filter((obj, pos, arr) => {
        return arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos;
    });
}

function formatResult(result) {
    return Math.round(result * 100)
}

exports.start = start;