var parseString = require('xml2js').parseString;
var fs = require("fs");
require('log-timestamp');

var modules = require('./scrivModules');
var mainModules = require('./mainModules.js');

// var f = "/Users/shahab/lighthouse/scriv/render3/render0.3.scriv";
// /Users/shahab/lighthouse/scriv/test/test-1.scriv;

var p = process.argv;

var render = false;//this variable determines if the code should create render ready excel file or not
if(p.includes('r')){
  render = true;
}
var noAnchor = false;
if(p.includes('na')){
  noAnchor = true;
}
f = p[p.length - 1];



mainModules.main(f,'yes',render,noAnchor);

console.log(`Watching for file changes on ${f}`);

fs.watchFile(f, (curr, prev) => {
  console.log(`${f} file Changed`);
  mainModules.main(f,'yes',render,noAnchor);
});

