var parseString = require('xml2js').parseString;
var fs = require("fs");
require('log-timestamp');

var modules = require('./scrivModules');
var mainModules = require('./mainModules.js');

// var f = "/Users/shahab/lighthouse/scriv/render3/render0.3.scriv";
// /Users/shahab/lighthouse/scriv/test/test-1.scriv;

var f = process.argv[2];//reads the file address from user input in terminal
var render = false;//this variable determines if the code should create render ready excel file or not
if(f === 'r'){
  f = process.argv[3];
  render = true;
}

mainModules.main(f,'yes',render);

console.log(`Watching for file changes on ${f}`);

fs.watchFile(f, (curr, prev) => {
  console.log(`${f} file Changed`);
  mainModules.main(f,'yes');
});

