
const Web3 = require('web3')
var storage = require('./storage')

// Files
const votingContractAbi = require('./abi/votingContractAbi.json')
const srnAbiJson = require('./abi/srnAbi.json')

// CONSTS
const UNIQUE_KEY = "address"
const infuraBaseAddress = 'wss://kovan.infura.io/ws/v3/'
const contractAddress = '0xa8D76bDbcA8f9258dC1bc51dE5DFedC7578c5A56'
const srnContractAddress = '0xba84e54676abdc25dcb33c7b0e1f25fb38d47508'
const infuraKey = '632d65efbe704a61b3a04b85fb921298'
const voteYesEventName = 'votedYesEvent'
const voteNoEventName = 'votedNoEvent'
const startBlock = 0
const TO_GWEI_FACTOR = 1000000000000000000

const web3 = new Web3(new Web3.providers.WebsocketProvider(infuraBaseAddress + infuraKey))

// Singelthon
var srnContract = new web3.eth.Contract(srnAbiJson, srnContractAddress);
var votingContract = new web3.eth.Contract(votingContractAbi, contractAddress);

const start = async function() {
    try {
        await calcResult(web3)
    } catch(e) {}

  // When we get a new vote, we should calc result again, for live version
  listenToVotes(web3)

  console.log(storage.fetchResult())
}

async function calcResult(web3) {
    return new Promise(async function(resolve, reject) {
        console.log("====getting all votes====")
        let votes = await getAllVotes(web3)

        console.log("====got "+votes.length+ " votes====")
        if (votes && votes.length > 0) {
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
            console.log(votersWithBalance);
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
    votingContract.once(voteYesEventName, {
        filter: {},
        fromBlock: 0,
    }, (error, event) => { calcResult(web3) })

    votingContract.once(voteNoEventName, {
        filter: {},
        fromBlock: 0,
    }, (error, event) => { calcResult(web3) })
}

async function getAllVotes(web3) {
    return new Promise(function(resolve, reject) {
        let allEvents = []
        votingContract.getPastEvents(voteYesEventName, {
            filter: {},
            fromBlock: startBlock,
            toBlock: 'latest'
        }, (error, events) => { 
            events = events.map(event => {
                event.vote = 1;
                return event
            });
            
            allEvents.push(...events)
            
            votingContract.getPastEvents(voteNoEventName, {
                filter: {},
                fromBlock: startBlock,
                toBlock: 'latest'
            }, (error, events) => { 
                events.map(event => {
                    event.vote = 0;
                    return event
                });
                allEvents.push(...events)
                resolve(allEvents)
            });                                     
        });
    });
}

function votesToAddressVoteMap(votes) {
    return votes.map(vote => {
        return { txHash:vote.transactionHash, address : vote.returnValues.voter, vote:vote.vote}
        });
}

function sumTotalBalanceOfVoters(votes) {
    return votes.map(vote => vote.balance).reduce((a, b) => a + b)
}

function calcPercentOfBalance(votes, totalBalance) {
    return votes.map(vote => {
        if (totalBalance > 0) {
            vote.strength = vote.balance / totalBalance
        } else {
            vote.strength = 0
        }
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