const Store = require('data-store');
const store = new Store({ path: 'result.json' });

function saveResult(result) {
    store.set('result', result); 
}

function fetchResult() {
    return store.data.result;
}

module.exports = {
    fetchResult : fetchResult,
    saveResult : saveResult
}