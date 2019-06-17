
const Web3 = require('web3')
var storage = require('./storage')

// Files
const votingContractAbi = require('./abi/votingContractAbi.json')
const srnAbiJson = require('./abi/srnAbi.json')

// CONSTS
const infuraBaseAddress = process.env.ETH_NODE_ADDRESS
const contractAddress = process.env.VOTING_CONTRACT
const srnContractAddress = process.env.COIN_CONTRACT
const nodeKEy = process.env.NODE_KEY
const voteYesEventName = 'votedYesEvent'
const voteNoEventName = 'votedNoEvent'
const startBlock = 0
const TO_GWEI_FACTOR = 1000000000000000000
const UNIQUE_KEY = "address"

const web3 = new Web3(new Web3.providers.WebsocketProvider(infuraBaseAddress + nodeKEy))
var srnContract = new web3.eth.Contract(srnAbiJson, srnContractAddress);
var votingContract = new web3.eth.Contract(votingContractAbi, contractAddress);

const start = async function() {
    try {
        await calcResult()
    } catch(e) {}

  // When we get a new vote, we should calc result again, for live version
  listenToVotes(web3)

  console.log(storage.fetchResult())
}

async function calcResult() {
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
            let res = votersWithBalance.filter(vote => vote.vote == 1)
            // create array with only address strength param
            .map(vote => vote.strength)
            //sum
            .reduce((a, b) => a + b)
            storage.saveResult(formatResult(res))
            resolve()
        } else {
            reject("no votes")
        }
    });
}

async function calcResultUntilBlock(blockNumber) {
    return new Promise(async function(resolve, reject) {
        try {
            console.log("====getting all votes====")
            let votes = await getAllVotes(web3, blockNumber)

            console.log("====got "+votes.length+ " votes====")
            if (votes && votes.length > 0) {
                console.log("====remove duplicates====")
                let votingMap = votesToAddressVoteMap(votes)
                votingMap = removeDuplicates(votingMap, UNIQUE_KEY)
                console.log("====got "+votingMap.length+ " votes without duplications====")
                console.log("====fetch balance for each address====")
                let votersWithBalance = await fetchBalanceForVoters(web3, votingMap, blockNumber)
                console.log("====calc total balance of voters====")
                let totalBalanceSum = sumTotalBalanceOfVoters(votersWithBalance)
                console.log("====calc percent of each vote====")
                votersWithBalance = calcPercentOfBalance(votersWithBalance, totalBalanceSum);
                console.log(votersWithBalance);
                console.log("====count yes and save in var====")
                let res = votersWithBalance.filter(vote => vote.vote == 1)
                // create array with only address strength param
                .map(vote => vote.strength)
                //sum
                .reduce((a, b) => a + b)
                resolve(buildFinalResultObject(res, votersWithBalance))
            } else {
                reject("error or no votes at all")
        }
    } catch(e) {
        console.log(e)
        reject("error calc result")
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

async function getAllVotes(web3, blockNumber) {
    if (!blockNumber) {
        blockNumber = 'latest'
    }
    return new Promise(function(resolve, reject) {
        let allEvents = []
        votingContract.getPastEvents(voteYesEventName, {
            filter: {},
            fromBlock: startBlock,
            toBlock: blockNumber
        }, (error, events) => { 
            events = events.map(event => {
                event.vote = 1;
                return event
            });
            
            allEvents.push(...events)
            
            votingContract.getPastEvents(voteNoEventName, {
                filter: {},
                fromBlock: startBlock,
                toBlock: blockNumber
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

function fetchBalanceForVoters(web3, voters, blockNumber) {
    const promises = voters.map(async vote => {
        vote.balance = formatBalance(await getSRNBalanceForAddress(web3, vote.address, blockNumber))
        return vote;
    })

    return Promise.all(promises);
}

function getSRNBalanceForAddress(web3, address, blockNumber) {
    if (blockNumber) {
        return srnContract.methods.balanceOf(address).call({}, blockNumber)
    } else {
        return srnContract.methods.balanceOf(address).call()
    }
}

function buildFinalResultObject(yesPercent, votes) {
    return {yesPercent:formatResult(yesPercent), votes:votes}
}

function formatBalance(balance) {
    if (balance) {
        return (parseInt(balance._hex, 16) / TO_GWEI_FACTOR);
    } else {
        return 0;
    }
}

function removeDuplicates(myArr, prop) {
    return myArr.filter((obj, pos, arr) => {
        return arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos;
    });
}

function formatResult(result) {
    return Math.round(result * 100)
}

module.exports = {
    start : start,
    calcResultUntilBlock : calcResultUntilBlock
}