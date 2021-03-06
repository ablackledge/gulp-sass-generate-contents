var through = require('through2');
var path = require('path');
var gulp = require('gulp');
var fs = require('fs');
var gutil = require('gulp-util');
var objectAssign = require('object-assign');
var PluginError = gutil.PluginError;
var File = gutil.File;

// Consts
const PLUGIN_NAME = 'sass-generate-contents';

function sassGenerateContents(destFilePath, creds, options){

	var defaults = {
		forceComments: true,
		contentsTable: true
	};
	var opts = objectAssign(defaults, options);
	var comments = '';
	var imports = '';
	var destFileName = getFileName(destFilePath);
	var newFile = createFile(destFilePath);
	var currentFilePath = '';
	var currentSection = '';
	var importArr = [];
	var commentsArr = [];
	var creds = typeof creds === 'object' ? creds : {};

	function getSpacer(len, spacer, minWidth){
		var spaceArr = [];
		var mw = minWidth || 0;
		var len = len + mw;
		for(var i = 0; i < len; i++){
			spaceArr.push(spacer);
		}

		return spaceArr.join('');
	}

	function getLongest(propList){
		var longest = 0;
		for (var prop in propList){
			if (propList.hasOwnProperty(prop)) {
				var propLength = prop.length
				if(propLength > longest) {
					longest = propLength;
				}
			}
		}
		return longest;
	}

	function createCreds(credsObj){

		if(!credsObj) {
			return;
		}

		var credStr = ['/* ============================================================ *\\\n'];
		credStr.push('  #MAIN\n')
		var count = 0;
		var credLongest = getLongest(credsObj);


		for (var cred in credsObj){
			if (credsObj.hasOwnProperty(cred)) {

				var val = credsObj[cred];
				var credLength = cred.length;
				var diff = credLongest - credLength;
				var spacer = getSpacer(diff, ' ');
				credStr.push('  ' + cred + ': ' + spacer + '' + val);

			}
		}
		credStr.push('\n/* ============================================================ */\n');

		return credStr;
	}



	function updateFile(newFile, imports, comments){
		// get the contents of the imports array
		if(importArr.indexOf(imports) < 0){
			//if the import doesn't exist add a new one
			importArr.push(imports);

		}

		var section = getSection(currentFilePath);
		if(section !== currentSection){
			currentSection = section;
			commentsArr.push('* \n* '+ currentSection.toUpperCase());
		}

		//get the contents of the comments array
		if(commentsArr.indexOf(comments) < 0){
			//if the comments don't exist add new ones
			commentsArr.push(comments);
		}

		// build site credentials iff passed in
		var credsArr = createCreds(creds);

		//Hack - quick array splitter
		var startArr = ['/**\n* CONTENTS'];
		var splitterArr = ['*\n*/\n\n\n\n'];
		var newContents;
		if(opts.contentsTable) {
			newContents = credsArr.concat(startArr, commentsArr, splitterArr, importArr).join('\n');
		} else {
			newContents = credsArr.concat(importArr).join('\n');
		}

		newFile.contents = new Buffer(newContents);

		return;
	}

	function getSection(filePath){
		var fileDirArray = path.parse(filePath).dir.split(path.sep);

		return fileDirArray[fileDirArray.length - 1];
	}

	function getFileName(filePath) {
		return path.basename(filePath);
	}

	function createFile(destFilePath){
		var newFile = new gutil.File({
			cwd: '',
			base: '',
			path: destFileName,
			contents: new Buffer('')
		});

		return newFile;
	}

	function throwWarning(fileName){
		gutil.log(PLUGIN_NAME + ' Comments missing or malformed in file: ' + fileName + ' - File not included\n');
	}

	function generateImportString(filePath) {
		var pathArray = path.normalize(filePath).split(path.sep);

		return '@import "' + pathArray.join('/') + '";';
	}


	/* main function */

	function buildString(file, enc, cb){

		currentFilePath = file.path;

		var fileName = getFileName(currentFilePath);

		//don't read the destination path (if in same folder)
		if (fileName === destFileName) {
			cb();
			return;
		}

		if (file.isNull()) {
			cb();
			return;
		}

		if (file.isStream()) {
			cb(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
			return;
		}

		var content = file.contents.toString('utf8');

		comments = content.split('\n')[0];
		var firstChars = comments.charAt(0) + comments.charAt(1);
		if(String(firstChars) !== '//' && opts.forceComments){
			throwWarning(fileName);
			return cb();
		}

		if(String(firstChars) !== '//' && !opts.forceComments){
			comments = '* ';
		}

		comments = comments.replace('//', '* ');

		imports = generateImportString(currentFilePath);

		updateFile(newFile, imports, comments);

		this.push(newFile);
		return cb();
	};

	return through.obj(buildString);
}

module.exports = sassGenerateContents;
