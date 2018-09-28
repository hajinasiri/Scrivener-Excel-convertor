
var xlsx = require('node-xlsx');
var fs = require('fs');
var ncp = require('ncp').ncp; //Module to copy folders
var dateTime = require('node-datetime');//Module for getting dateTime

var scrivModule = require('./mainModules.js')

// var f = "/Users/shahab/lighthouse/scriv/render3/GenderFinance4.9test.xlsx";
var f = process.argv[2];//reads the file address from user input in terminal
var update = false;
var result =[];
if(f === "u"){
  update = true;
    // var f = "/Users/shahab/lighthouse/scriv/render3/render0.3.scriv";
  var excelPath = process.argv[3];
  var scrivPath = process.argv[4];
  result = scrivModule.main(scrivPath,'No',false)[0];//puts the scriv file in an array and puts it in 'result' variable. "No" determins that no excel file needs to be created
  //"false" determins that the render ready excel file doesn't need to be created
  f = excelPath;
}

if(update){
  var scriv = scrivPath.substr(0,scrivPath.lastIndexOf('scriv'))
  scriv = scriv.substr(0,scriv.lastIndexOf('/')) + '/updated';
  scriv += scrivPath.substr(scrivPath.lastIndexOf('/') + 1,scrivPath.lastIndexOf('scriv'));
  var fileName = scriv.substr(scriv.lastIndexOf('/'), scriv.length) + 'x';
  var scrivx =scriv +fileName; //builds the destination path for scrivx file
}else{
  var scriv = f.substr(0,f.indexOf('xlsx')) + 'scriv'; //builds the destination path for scriv file
  var fileName = scriv.substr(scriv.lastIndexOf('/'), scriv.length) + 'x';
  var scrivx =scriv +fileName; //builds the destination path for scrivx file
}

ncp.limit = 16;//part of the module
ncp('./template.scriv', scriv, function (err) { //copies the template scriv file to the destination of scriv with the final name
  if (err) {
    return console.error(err);
  }else{
    var text = main();
    writeFile(scrivx,text);
  }
  console.log('done!');
});

function main(){
  var excel = xlsx.parse(f); // parses the excel file
  var text = fs.readFileSync('./template.xml').toString('utf-8'); //reads the template.scrivx file and puts it in text
  var keywords = getKeywords(excel);
  text = text.replace('<Map></Map>', buildMap(excel,keywords))
  text = text.replace('<Keywords></Keywords>', buildKeywords(excel,keywords));
  text = text.replace('<CustomMetaDataSettings></CustomMetaDataSettings>' , buildCustomMetaDataSettings(excel)); //builds CustomMetaDataSettings part and puts it in the text
  text = text.replace('&','&amp;');
  return text
}

function writeFile(path,text){//This function writes the text to the path of the file
      fs.writeFile(path, text, function(err) {//writes the text to scrivx file
      if(err) {
          return console.log(err);
      }
    });
}

function buildCustomMetaDataSettings(excel){
  var metaSetting = excel[0].data[0];
  metaSetting.splice(0,2);//removes manually added metadata
  metaSetting.splice(1,6);//removes manually added metadata
  var str = '';
  metaSetting.forEach(function(meta){
    str += '\n      <MetaDataField ID="' + meta + '" Type="Text" Wraps="No" Align="Left">\n       <Title>' + meta + '</Title>\n      </MetaDataField>\n';
  })
  str = '<CustomMetaDataSettings>' + str + '    </CustomMetaDataSettings>';
  return str
}

function getKeywords (excel){ //makes an object of all the classes and returns the object
  var keywords = {};
  var classes;
  var rows = excel[0].data;//This lines puts all the rows in "rows" variable
  rows.forEach(function(row,index){//goes through each row
    if(row[8] && index ){//skips the row 0 which is the row that contains column titles
      classes = row[8];
      classes = classes.split(' ');
      classes.forEach(function(element){
        if(element && !(element in keywords)){
          keywords[element] = index;
        }
      })
    }
  });
  return keywords
}

function buildKeywords(excel,keywords){
  var str = '';
  for (var key in keywords) {
    str += '     <Keyword ID="' + keywords[key] + '">\n        <Title>' + key + '</Title>\n       <Color>0.614707 0.655123 1.0</Color></Keyword>\n'
  }
  str = '<Keywords>\n' + str + '    </Keywords>'
  return str
}

function buildMap(excel,keywords){
  var mapStr = '';
  var match = '';
  var rows = excel[0].data;

  var l = rows[0].length; //this stores the length of the rows, so later l can be used to add labelID to the row if needed

  rows.forEach(function(row,index){


    result.forEach(function(element){//finds the matching row in the array built from scriv file and puts it in variable 'match'

      if(row[2] === element.id){
        match = element;
      }
    });
    if(match){//if there is a match then check if anything has changed
      rows = checkMatch(index,6,match,'shortdescription',l,rows);//checks if shortDescription has changed and updates it;
      rows = checkMatch(index,7,match,'longdescription',l,rows);//checks if longDescription has changed and updates it;
      rows = checkMatch(index,1,match,'label',l,rows);
      rows = getMeta(index,rows,match);
    }
    if(index > 0){//index 0 is the first row in excel that contains column titles
      mapStr += '\n' +buildBinderItem(row,rows,index);//adding the binderItem string to it
      mapStr += '\n  <Title>' + row[1]+ '</Title>';
      mapStr += buildMetaData(row,rows);
      mapStr += buildUnoKeywords(row,keywords);
      mapStr += buildClose(row,rows,index);
    }

  });
  return mapStr
}

function getMeta(index,rows,match){
  if(index > 0){
    var row = rows[index];
    var columns = rows[0];
    for(i=8; i<row.length; i++){
      // if(match[columns[i].toLowerCase()] !== undefined){

      // console.log(rows[index][i],match[columns[i].toLowerCase()]);

      // }

      rows[index][i] = match[columns[i].toLowerCase()];
    }
  }
  return rows
}
function checkMatch(index,columnNumber,match,columnDescription,l,rows){//finds the matching uno in excel and scrivener and does updating
  var row = rows[index];
  var excelUno = row[columnNumber];
  if(excelUno){excelUno = clean(excelUno)}
  var scrivUno = match[columnDescription];
  scrivUno = match[columnDescription];
  if(scrivUno){scrivUno = clean(scrivUno)};


  if((excelUno === scrivUno) || (!excelUno && !scrivUno)){//if the old and new long/short-description are the same or both are empty

  }else {//if they are different, then the new short/long-description gets copied in the row which will be used to create the scriv file
    rows[index][l] = 1; //adds the labelID "1" to the uno
    rows[0][l] = 'LabelID';//adds the labelID tag to the first row if doesn't exist already

    console.log(columnDescription,'in', match.title,'was updated');

  }
  return rows
}

function clean(text){//cleans the text from all the unwanted characters added by Excel or scrivener to make the texts comparable
  text = text.toString();
  if(text ){
    while(text.indexOf("\r") > -1 || text.indexOf("\t") > - 1 || text.indexOf(" ") > - 1){

      text = text.replace("\r",'');
      text = text.replace(/\t/g,'');
      text = text.replace(/\n/g,' ');
      text = text.replace(/ /g,'');
    }
  }

  return text
}

function buildBinderItem(row,rows,index){
  var binderItem = '';

  if(rows[index - 1][5] !=='outline' && row[5] > rows[index - 1 ][5]){
    binderItem += '\n<Children>';
  }
  for(i=0;i<row[5] + 2;i++){
    binderItem += ' '
  }
  binderItem += '\n<BinderItem UUID="' + index + '" ';
  var content = scriv+'/files/data/' + index ;//puts the address for content.rtf's folder for this row in variable content
  if (!fs.existsSync(content)) {//if the content folder does not exist
    fs.mkdirSync(content ); //creates the folder with row index as UUID for putting content.rtf and synopsis
  }
  if(row[6]){
    writeFile(content+'/synopsis.txt', row[6]);//writes the synopsis file
  }
  if(row[7]){
    writeFile(content+'/content.rtf',row[7]);//writes the content.rtf file
  }
  if(rows[index + 1] && row[5]<rows[index + 1][5]){//if outline number of this row is smaller than the next one's
    binderItem += 'Type="Folder"';
  }else{
    binderItem += 'Type="Text"';
  }
  var dt = dateTime.create();//gets date
  var formatted = dt.format('Y-m-d H:M:S');//formatting date
  var date = formatted + ' -0700';//adds needed string to it
  binderItem += ' Created="' + date + '"' + ' Modified="' + date + '">';//adds it to the binderItem
  return binderItem;
}

function buildMetaData(row,rows){
  var metaStr = '\n<MetaData>\n';
  if(rows[0][rows[0].length - 1] === 'LabelID' && row.length === rows[0].length){//if the uno has a labelId that is always 1, then the label
    //gets added to the metadata
    metaStr += '<LabelID>1</LabelID>';
  }
  metaStr +='   <IncludeInCompile>Yes</IncludeInCompile>\n  <CustomMetaData>\n  <MetaDataItem> \n      <FieldID>id</FieldID>\n  <Value>' + row[2] + '</Value>\n   </MetaDataItem>';
  for(i=9; i<row.length;i++){//going through metadata columns
    if(row[i]){
      metaStr += '\n  <MetaDataItem> \n      <FieldID>' + rows[0][i] +'</FieldID>\n      <Value>' + row[i] + '</Value>\n</MetaDataItem>';
    }
  }
  metaStr += '\n     </CustomMetaData>\n</MetaData>';
  metaStr +=  '\n<TextSettings>\n<TextSelection>0,0</TextSelection>\n</TextSettings>';
  return metaStr
}

function buildUnoKeywords(row,keywords){
  var keyStr = '';

  if(row[8]){
    var classes = row[8];
    classes = classes.split(' ');
    keyStr = '\n<Keywords>';
    classes.forEach(function(element){
      if(keywords[element]){
        keyStr += '\n<KeywordID>' + keywords[element] + '</KeywordID>';
      }
    });
  keyStr += '\n</Keywords>';
  }

  return keyStr
}


function buildClose(row,rows,index){
  var closeStr = '';
  var difference = 0;

  if(rows[index + 1]){
    difference = row[5]-rows[index + 1][5];

  }else{
    difference = row[5];
  }

  if(difference >-1){
    closeStr += '\n</BinderItem>';
  }

  for (i=0; i<difference; i++){
    closeStr += '    \n</Children>\n</BinderItem>';
  }
  return closeStr
}









