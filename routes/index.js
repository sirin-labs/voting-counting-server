var express = require('express');
var router = express.Router();
var storage = require('../voting/storage')
var votingManager = require('../voting/votingManager')

// Get result valid for block number
router.get('/:blockNumber', async function(req, res, next) {
  let result;
  try {
  result = await votingManager.calcResultUntilBlock(req.params.blockNumber)
  } catch(e) {
    res.status(500).send(e)
  } finally {
    res.json(result)
  }
});

// Get result valid for latest block
router.get('/', function(req, res, next) {
  res.json({result : storage.fetchResult()})
});

module.exports = router;
