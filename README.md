# BagIt-Utility 
A Material Design desktop application to create tar-serialized bags

Requirements:
This was developed using node.js and electron. You'll need npm installed and
the rest should magically appear when running "npm install"

To Run:
In the source directory, you can use "npm start" to start it.  It can also be
packaged as a standalone application

Using the utility:
* Select a directory to bag in the "Source Files" tab by clicking the folder FAB
* Enter the metadata on the "Standard Tags" tab.
  * pre-defined values can be supplied by modifying defaults.txt
* Create the bag by pressing the wrench FAB on the "Create Bag" tab
  * If there are errors in the configuration, it will list them in the status

The menu has an about, exit, and a debug (which opens up the web dev tools)

DISCLAIMER:  I'm not a javascript sort of guy so the code is probably pretty
ugly to those who are.  This is mostly a prototype to see if it is even
feasible.  Your mileage may vary.  Limit one per customer.  No substitutions.

Note:  This package includes the Material Design Lite javascript and CSS files
which are owned by someone else, I'm sure.
