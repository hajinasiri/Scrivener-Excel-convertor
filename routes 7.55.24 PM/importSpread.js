/**
 * This will load in a spreadsheet and replace the collection with the data in the
 * spreadsheet.
 * It knows what the colection is because it uses the path before the "spreadSheet"
 * command to lookup the config file in that path, and pull out the collection name, which
 * should always contain the characters, "master"
 * Written by Larry Madocks
 **/
var express = require('express');
var router = express.Router();
var restrict = require('../auth/restrict');
var multer = require("multer");
var xlsxj = require("xlsx-to-json");
var mapService = require('../services/map-service');
//var mongoXlsx = require("mongo-xlsx");
var dbVersion = require('../services/dbVersion'); //to update row in map dbVersion database
//var hbs = require('hbs');
//hbs.handlebars === require('handlebars');
const fs = require('fs');
var path = require('path');


var unauthStatic = express.static(path.join(__dirname, '../public'));
var authStatic = path.join(__dirname, '../authorized');



/* GET home page. */
router.get('/', restrict, function(req, res, next) {
    /**
     * Was getting this error when using a folder in the url as a parameter:   "Refused to apply style from" "because its 
     * MIME type ('text/html') is not a supported stylesheet MIME type"
     * Found someone talking about this on stackoverflow, but it was in Spanish, plus the fix is too complicated 
     * for using a folder as a parameter in the url. So I will have user insert folder in a form field.
     **/
    //router.get('/:collection', function(req, res, next) {
    // var collection = req.params.collection;
    //  if (!(/master/.test(collection))) {
    //         let err = "Invalid Collection: "+ collection;
    //         console.error();
    //         let vm = {
    //             messageTitle: 'Error',
    //             layout: 'simpleLayout',
    //             serverMessage: err
    //         };
    //         console.error("Incorrect collection.");
    //         res.redirect('/error');

    //     }
    return res.render('admin/importSpread', {
        title: 'Import Data or SVG',
        layout: 'simpleLayout',
        baseUrl: JSON.stringify(req.baseUrl)
        //,collection:'master_test3'
    });
});

//for some reason we are getting undefined fields from the excel file. This deletes them
function removeJunk(obj) {
    for (var prop in obj) {
        if (prop.length == 0) {
            delete obj[prop];
        }
    }
}
/**
 * Looks in list to see if key is in there. If so returns true
 **/
function inList(list, key) {
    return list.split(',').indexOf(key) > -1
}


////var upload = multer({ dest: './import' });
// Set The Storage Engine
var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        if (req.dynamicDestination) {
            cb(null, req.dynamicDestination);
        }
        else cb("Error determining destination of file");

    },
    filename: function(req, file, cb) {
        var fn = file.originalname + '-' + Date.now() + path.extname(file.originalname);
        req.myFileName = fn;
        cb(null, fn);
    }
});

// Init Upload
const upload = multer({
    limits: { fileSize: 10000000 },
    fileFilter: function(req, file, cb) {
        checkFileTypeAndPermissions(req, file, cb);
    },
    storage: storage
}).single('myFile'); //This tag, "myFile" MUST match the form input name attribute in the importFile.hbs file

//Get destination folder of where spreadsheet file is sent to
function destination(req, file) {
    var pathToConfigFile = req.params.path;
    //Now get the config.json data to get the collection name
    pathToConfigFile !== undefined ? pathToConfigFile = pathToConfigFile.replace(/slshslash/g, "\/") : pathToConfigFile = null; //instead of a "/" I replaced it with "slshslash" so it doesn't count as another parameter. This line changes it back to the slash ("/")
    if (pathToConfigFile) {
        var dynamicDestination = authStatic + "/" + pathToConfigFile;
        req.pathToConfigFile = pathToConfigFile; //insert this value in req so I can use it later on in checkFileTypeAndPermissions()
        req.dynamicDestination = dynamicDestination; //insert this in req so I can access it later on
        return pathToConfigFile; // successfully found destination. Code was this: cb(null, dynamicDestination);
    }
    else return null; //cb("Error determining destination of file");
}
// Check File Type and permissions
function checkFileTypeAndPermissions(req, file, cb) {
    // Allowed ext
    const filetypes = /svg|txt|js|css|html|md|json|xlsx|ai|jpeg|jpg|png|gif|sheet/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (!extname) {
        return cb('Error: Incorrect file extension!');
    }
    // Check mime
    const mimetype = filetypes.test(file.mimetype);
    if (!mimetype) {
        return cb('Error: Incorrect file mimetype!');
    }
    var pathToConfigFile = destination(req, file); //set destination
    var permissions = req.user._doc.doc.permissions;
    if (!(inList(permissions, 'admin') || inList(permissions, 'editor') || inList(permissions, 'designer'))) {
        //  return res.redirect('/'); // not found
        return cb('Invalid permission.');

    }
    else if (inList(permissions, 'designer')) {
        var authorizedFolders = req.user._doc.doc.hasOwnProperty("folders") ? req.user._doc.doc.folders : "";
        
        if (pathToConfigFile) {
            var mainUrlFolder = req.pathToConfigFile; // req.originalUrl;
            var firstFolder = mainUrlFolder.split("/").slice(0,1).toString(); //get first folder (or directory) in the url string
            if (!(authorizedFolders.split(',').indexOf(firstFolder) > -1)) {
                //only compare the first folder, which would be > -1 if it were a match.
                return cb('Folder Not Available. Please check with your administrator for access to folder: ' + firstFolder);

            }
            return cb(null, true);
        } else {
            cb("Error determining destination of file");
        }

    }

     return cb(null, true); //the user is either an admin or editor so have permissions in all folders. TODO: editor has all permissions?
}



//router.use(express.static(path.join(__dirname, '../authorized')));
//var upload = multer({ storage : storage}).single('xlsx');
//after posting a spreadsheet file to upload, which will be saved in this folder
//and then inserted into the database.  DO NOT CHANGE THIS FROM import!!
router.post('/:path', restrict,
    function(req, res, next) {

        //now look to see if user permissions contain admin


        upload(req, res, function(err) {
                if (err) {
                    res.json({
                        status: "error",
                        msg: err
                    });
                }
                else {


                    var pathToConfigFile = req.params.path;
                    //Now get the config.json data to get the collection name
                    pathToConfigFile !== undefined ? pathToConfigFile = pathToConfigFile.replace(/slshslash/g, "\/") : pathToConfigFile = null; //instead of a "/" I replaced it with "slshslash" so it doesn't count as another parameter. This line changes it back to the slash ("/")
                    if (pathToConfigFile) {
                        //'utf8', means return a string . If I take that out, then I get binary data back instead of a json structure.
                        fs.readFile(authStatic + "/" + pathToConfigFile + "/config.json", 'utf8', (err, data) => {
                            if (err) return res.json({
                                status: "error",
                                msg: 'Invalid path for config.json.'
                            });
                            var data2json = JSON.parse(data);
                            if (data2json == undefined) {
                                console.error("Bad json in config.file: " + pathToConfigFile + "/config.json");
                                return res.json({
                                    status: "error",
                                    msg: "Bad json in config.file: " + pathToConfigFile + "/config.json"
                                });
                            }
                            var collection = data2json.masterDB; //user see just a folder name. This adds _master to user the folder_master collection

                            //User can have multiple permissions, I suppose. If he has admin permissions and or editor permissions here 
                            //then he can upload a spreadsheet. But if he only has designer, then he needs to have the collection
                            //in the list of collections he can upload to.
                            // var permissions = req.user._doc.doc.permissions;
                            // if (!inList(permissions, 'admin') && !inList(permissions, 'editor') && inList(permissions, 'designer')) {
                            //     var authorizedCollections = req.user._doc.doc.collections;

                            //     if (!inList(authorizedCollections, collection)) {
                            //         //only compare the first folder, which would be > -1 if it were a match.
                            //         return res.json({
                            //             status: "error",
                            //             msg: 'Missing permission for this collection.'
                            //         });
                            //     }
                            // }
                            var filePath = req.dynamicDestination + '/' + req.myFileName; //req.files[0].path; //do not add this because then it cannot find the file path + ".xlsx" 

                            if (!(/master/.test(collection))) {
                                let err = "Invalid Collection";
                                console.error();
                                let vm = {
                                    messageTitle: 'Error',
                                    layout: 'simpleLayout',
                                    serverMessage: err
                                };
                                console.error("Incorrect collection.");
                                res.redirect('/error');

                            }

                            // console.log(data); //masterDB
                            if (filePath && collection) {
                                //console.log("file path here: " + filePath);
                                // mongoXlsx.xlsx2MongoData(filePath, null, function(err, mongoData) {
                                //     if (err) {
                                //         console.error(err);
                                //         res.redirect('/error');
                                //     }
                                //     else {
                                //         console.log('Mongo data:', mongoData);
                                //     }
                                // });
                                xlsxj({
                                    input: filePath, //__dirname + '/sample.xlsx',
                                    sheet: "Structure",
                                    output: null // set this to null if you are not using it!!! __dirname + '/output.json'
                                }, function(err, result) {
                                    if (err) {
                                        console.error(err);
                                        res.redirect('/error');
                                    }
                                    else {
                                        mapService.removeAll(collection, (err) => {
                                            if (err) {
                                                console.error(err);
                                                res.redirect('/error');
                                            }
                                            for (var i = 0; i < result.length; i++) {
                                                var row = result[i];
                                                if (!row.hasOwnProperty('rowNumber')) {
                                                    row.rowNumber = i.toString();
                                                }
                                                if (row.hasOwnProperty('id') && row.id.length == 0) {
                                                    row.id = i.toString();
                                                }
                                                else if (!row.hasOwnProperty('id')) {
                                                    row.id = i.toString();
                                                }
                                                removeJunk(row); //for some reason we are getting undefined fields from the excel file. This deletes them
                                                if (row.hasOwnProperty('id') && row.id.length > 0) {
                                                    var id = row.id;
                                                    var rowNumber = Number(row.rowNumber);
                                                    let doc = {
                                                        id: id,
                                                        rowNumber: rowNumber,
                                                        doc: row
                                                    };
                                                    mapService.addmap(doc, collection, function(err) {
                                                        if (err) {
                                                            console.error(err);
                                                            res.redirect('/error');
                                                        }
                                                    });
                                                }

                                            }
                                            dbVersion.updateRow(collection, (err, doc) => {
                                                if (err) {
                                                    //Need to update the version number of this db
                                                    console.log("Error updating dbVersion. Will create a new row for this collection slash db. Err: " + err);
                                                    dbVersion.addRow({
                                                        dbName: collection,
                                                        dbVersion: 1
                                                    }, () => {
                                                        // var vm = {
                                                        //     status: 'success',
                                                        //     msg: 'success in updateRow for map. id: ' + data.id,
                                                        //     dbVersion: 1
                                                        // };

                                                        // res.status(status).json(vm);
                                                        //next(null);

                                                        res.status(204).end();
                                                        //res.status(200).end();
                                                        //res.render('import', vm);
                                                    });

                                                }
                                                else {
                                                    /* update dbVersion of this collection */


                                                    //doc contains the version number that we are sending back
                                                    // var vm = {
                                                    //     dbVersion: doc,
                                                    //     status: 'success',
                                                    //     msg: 'success in updateRow for dbVersion. collection: ' + collection
                                                    // };

                                                    //res.status(status).json(vm);
                                                    //next(null);
                                                    res.status(204).end();
                                                    //res.status(200).end();
                                                    //res.render('import', vm);
                                                }
                                            });
                                        });

                                        //console.log(result);
                                    }
                                });



                            } //if (filePath && collection) 
                        });
                    }
                    else {
                        return res.json({
                            status: "error",
                            msg: 'Invalid path for config.json.'
                        });
                    }



                    res.json({
                        status: "Success"
                    });
                }




            } //upload(req, res, function(err) {
        );


    } //function(req, res, next) {
);

module.exports = router;
