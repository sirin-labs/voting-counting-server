var express = require('express');
var router = express.Router();
var storage = require('../voting/storage')

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({result : storage.fetchResult()})
});

module.exports = router;
