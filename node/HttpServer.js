/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true */
/*global */

(function () {
    "use strict";
    
    var http = require('http'),
        connect = require('connect');
    
    var httpNamespace = {};
    var servers = [];
    var serverCount = 0;
    
    httpNamespace.createServer = function (root, cb) {
        var app = connect();
        
        app.use(connect.favicon())
            .use(connect.logger('dev'))
            .use(connect["static"](root))
            .use(connect.directory(root));

        var server = http.createServer(app);
        
        var socket = server.listen(0, '127.0.0.1', function () {
            if (socket) {
                var serverID = serverCount++;
                servers[serverID] = {app: app, server: server, socket: socket};
                cb(socket.address(), serverID);
            }
        });
    };

    // TODO: This doesn't seem to actually stop the server :-)
    httpNamespace.stopServer = function (serverID, cb) {
        console.log("trying to stop server with id", serverID);
        var s = servers[serverID];
        if (s) {
            console.log("got a server:", s);
            s.server.close(function () { cb("ok"); });
        } else {
            console.log("didn't get a server");
        }
    };
    

    
}());
