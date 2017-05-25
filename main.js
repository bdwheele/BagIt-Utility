const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const Menu = electron.Menu
const path = require('path')
const url = require('url')
const ipc = require('electron').ipcMain
const dialog = require('electron').dialog
const fs = require('fs');
const digestStream = require('digest-stream');
const PromisePool = require('es6-promise-pool');
const tar = require('tar-stream');


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow
let debug = false;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600})
  //mainWindow.webContents.openDevTools();
  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
    createWindow()
    Menu.setApplicationMenu(null)    
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipc.on('exit-application', function() {
    app.quit();
});

ipc.on('debug-process', function() {
    if(debug) {
        debug = false;
        mainWindow.webContents.closeDevTools();
    } else {
        debug = true;
        // Open the DevTools.
        mainWindow.webContents.openDevTools();
    }
});

// Source content functionality

ipc.on('open-directory-dialog', function(event) {
    dialog.showOpenDialog({
        title: "Source for Bag Content",
        properties: ['openDirectory']
    }, function(files) {
        console.log("files: " + files);
        if(files != null) {
            event.sender.send('selected-directory', files);
        }
    });
});

ipc.on('scan-files', function(event, bag, filename) {
    bag.sourceDir = filename;
    bag.fileCount = 0;
    bag.fileSize = 0;
    bag.files = [];
    bag.listing = "";
    let toDo = [];
    let walkSync = function(baseDir, dir, depth) {            
        depth = depth || 0;
        dir = dir || "";
        let files = fs.readdirSync(baseDir + "/" + dir);
        files.forEach(function(file) {
            try {
                let stat = fs.statSync(baseDir + "/" + dir + "/" + file);
                let sdir = dir == ""? "" : dir + "/";
                if (stat.isDirectory()) {
                    walkSync(baseDir, sdir + file, depth + 1);
                } else {
                    bag.fileCount++;
                    bag.fileSize += stat.size;
                    bag.files.push(sdir + file);
                    bag.listing += sdir + file + "\n";
                    toDo.push(sdir + file);
                }
            } catch(err) {
                console.log(err.message);
            }
        });
    };
    walkSync(filename);
    bag.tags["Payload-Oxum"] = bag.fileSize + "." + bag.fileCount;
    bag.tags["Bag-Size"] = getReadableFileSizeString(bag.fileSize);
    bag.tags["Bagging-Date"] = new Date().toISOString().slice(0,10);
    event.sender.send('scan-files-done', bag);
});


// Create bag functionality
ipc.on('save-bag-dialog', function(event) {
    dialog.showSaveDialog({title: 'Create a new bag',
                           filters: [
                               {name: 'Tarballs', extensions: ['tar'] },
                           ]
                          }, function(filename) {
                              if(path.extname(filename) != '.tar') {
                                  if(path.extname(filename) == '.') {
                                      filename += "tar";
                                  } else {
                                      filename += ".tar";
                                  }
                              }
                              event.sender.send('saved-file', filename);
                              app.addRecentDocument(filename);
                          });
});


ipc.on('build-bag', async function(event, bag, filename) {
    let errors = [];
    let messages = [];
    const pack = tar.pack();
    const baseDir = path.basename(filename, '.tar') + "/";
    let tarballStream = fs.createWriteStream(filename, { defaultEncoding: 'binary' });
    pack.pipe(tarballStream);
    pack.entry({name: baseDir + "bagit.txt"}, "BagIt-Version: 0.97\nTag-File-Character-Encoding: UTF-8\n");
    let bagInfo = "";
    for(let tag in bag.tags) {
        bagInfo += tag + ": " + bag.tags[tag] + "\n";
    }
    pack.entry({name: baseDir + "bag-info.txt"}, bagInfo);
    bag.manifest = "";
    for(let i = 0; i < bag.files.length; i++) {
        let file = bag.files[i];
        event.sender.send('saved-file-progress', file, bag.fileCount == 0? 0 : (i / bag.fileCount) * 100);
        let stat = fs.statSync(bag.sourceDir + "/" + file);
        await new Promise((resolve, reject) => {
            let entry = pack.entry({name: baseDir + "data/" + file,
                                    size: stat.size}, function(err) {
                                        if(err) {
                                            errors.push(err);                                            
                                        } else {                                                
                                            entry.end();
                                            resolve();
                                        }
                                    });
            let input = fs.createReadStream(bag.sourceDir + "/" + file);
            let dstream = digestStream('md5', 'hex', function(digest, length) {
                bag.manifest += digest + "  data/" + file + "\n";
            });
            input.pipe(dstream).pipe(entry);            
        });
    }
    if(errors.length == 0) {
        let stat = fs.statSync(filename);
        messages.push("Successfully created tarball in " + filename);
        messages.push("  " + bag.fileCount + " payload files in bag");
        messages.push("  " + getReadableFileSizeString(stat.size) + " in tarball.");
    }
    pack.entry({name: baseDir + "manifest-md5.txt"}, bag.manifest);    
    pack.finalize();
    event.sender.send('saved-file-done', errors, messages);
});




// Helper stuff
function getReadableFileSizeString(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
};
