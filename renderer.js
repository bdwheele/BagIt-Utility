// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const ipc = require('electron').ipcRenderer
const fs = require('fs');

var bag = {
    sourceDir: null,
    tags: {},
    fileCount: 0,
    fileSize: 0,
    files: [],
   
};

// Set up side menu actions
{
    let dialog = document.querySelector('#about-dialog');
    let aboutMenu = document.querySelector('#about-menu');
    aboutMenu.addEventListener('click', function() {
        dialog.showModal();
    });
    dialog.querySelector('.close').addEventListener('click', function() {
        dialog.close();
    });

    let exitMenu = document.querySelector("#exit-menu");
    exitMenu.addEventListener('click', function() {
        console.log("Exiting");
        ipc.send('exit-application');
    });

    let debugMenu = document.querySelector("#debug-menu");
    debugMenu.addEventListener('click', function() {
        ipc.send('debug-process');
    });    
}                                            

// handle things on the source content tab
{
    let openDir = document.querySelector("#bag-data-source-button");
    openDir.addEventListener('click', function() {
        ipc.send('open-directory-dialog');
    });

    ipc.on('selected-directory', function(event, path) {
        path = path[0];
        let dialog = document.querySelector('#filescan-dialog');
        dialog.showModal();
        ipc.send('scan-files', bag, path);
    });

    ipc.on('scan-directory', function(event, dir) {
        let span = document.querySelector('#scan-directory');
        span.textContent = dir;
    });

    
    ipc.on('scan-files-done', function(event, newBag) {
        let dialog = document.querySelector('#filescan-dialog');
        dialog.close();
        bag = newBag;
        let bds = document.querySelector("#bag-data-source");
        bds.textContent = bag.sourceDir;
        let pre = document.querySelector("#bag-data-source-listing");
        pre.textContent = bag.listing;
    });   
}

// handle things in the standard tags tab
{
    let tagsTab = document.querySelector("#std-tags-tab");
    let loadedDefaults = false;
    tagsTab.addEventListener('click', () => {
        if(!loadedDefaults) {
            loadedDefaults = true;
            let lines = fs.readFileSync("defaults.txt", "utf-8").split("\n").filter(Boolean);
            for(let i = 0; i < lines.length; i++) {
                let parts = lines[i].split(':', 2);
                let key = parts[0].trim();
                let value = parts[1].trim();
                let field = document.querySelector("#std-" + key);
                if(field) {
                    field.parentNode.MaterialTextfield.change(value);
                }
            }
        }
    });
}

// handle things in the create bag tab
{
    let bagTab = document.querySelector('#bag-tab');
    let button = document.querySelector("#bag-build-button");
    let status = document.querySelector("#bag-build-status");
    let messages = document.querySelector("#bag-build-messages");
    
    bagTab.addEventListener('click', function() {
        let errors = [];
        if(bag.sourceDir == "" || bag.sourceDir == null) {
            errors.push("A source directory for the content must be supplied");
        }

        let requiredStdTags = ['Source-Organization', 'Organization-Address',
                               'Contact-Name', 'Contact-Email',
                               'External-Identifier'];
        let optionalStdTags = ['Contact-Phone', 'External-Description',
                               'Bag-Group-Identifier', 'Bag-Count',
                               'Internal-Sender-Identifier',
                               'Internal-Sender-Description'];
        for(let x of requiredStdTags) {
            let input = document.querySelector("#std-" + x);
            let text = input.value.trim();
            if(text == "") {
                errors.push("Standard Tag " + x + " must be supplied");
                delete bag.tags[x];
            } else {
                bag.tags[x] = text.trim();
            }
        }
        for(let x of optionalStdTags) {
            let input = document.querySelector("#std-" + x);
            let text = input.value.trim();
            if(text != "") {
                bag.tags[x] = text.trim();
            } else {
                delete bag.tags[x];
            }
        }


        if(errors.length == 0) {
            status.textContent = "Bag is ready to build!";
            messages.textContent = "";
            button.disabled = false;
        } else {
            status.textContent = "Bag configuration has errors";
            messages.textContent = errors.join("\n");
            button.disabled = true;
            
        }        
        componentHandler.upgradeElement(button);
    });

    button.addEventListener('click', function() {
         ipc.send('save-bag-dialog');
    });

    ipc.on('saved-file', function(event, path) {
        console.dir(path);
        let dialog = document.querySelector('#build-dialog');
        dialog.showModal();
        ipc.send('build-bag', bag, path);
    });

    ipc.on('saved-file-done', function(event, errors, msg) {
        let dialog = document.querySelector('#build-dialog');
        dialog.close();
        if(errors.length == 0) {
            status.textContent = "Build Successful!";
            messages.textContent = msg.join("\n");
        } else {
            status.textContent = "Could not build tarball";
            messages.textContent = errors.join("\n");
        }
    });   

    ipc.on('saved-file-progress', function(event, file, percent) {
        let status = document.querySelector('#build-step');
        status.textContent = file;
        let progress = document.querySelector("#pack-progress");
        progress.MaterialProgress.setProgress(percent);
    });

    
}
