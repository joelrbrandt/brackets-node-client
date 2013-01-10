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
maxerr: 50, browser: true */
/*global $, define, brackets, WebSocket */

define(function (require, exports, module) {
    "use strict";
    
    var CONNECTION_ATTEMPTS = 10;
    var CONNECTION_TIMEOUT  = 10000; // 10 seconds
    var RETRY_DELAY         = 500;   // 1/2 second
    // NOTE: It's okay for the connection timeout to be long because the
    // expected behavior of WebSockets is to send a "close" event as soon
    // as they realize they can't connect. So, we should rarely hit the
    // connection timeout even if we try to connect to a port that isn't open.


    // Helper function to auto-reject a deferred after a given amount of time.
    // If the deferred is resolved/rejected manually, then the timeout is
    // automatically cleared.
    function setDeferredTimeout(deferred, delay) {
        var timer = setTimeout(function () {
            deferred.reject();
        }, delay);
        deferred.always(function () { clearTimeout(timer); });
    }
    
    // Helper function to attempt a single connection to the node server
    function attemptSingleConnect() {
        var deferred = $.Deferred();
        var port = null;
        var ws = null;
        setDeferredTimeout(deferred, CONNECTION_TIMEOUT);
        
        brackets.app.getNodeState(function (err, nodePort) {
            if (!err && nodePort && !deferred.isRejected()) {
                port = nodePort;
                ws = new WebSocket("ws://localhost:" + port);
                
                // If the server port isn't open, we get a close event
                // at some point in the future (and will not get an onopen 
                // event)
                ws.onclose = function () {
                    deferred.reject();
                };

                ws.onopen = function () {
                    // If we successfully opened, remove the old onclose 
                    // handler (which was present to detect failure to 
                    // connect at all).
                    ws.onclose = null;
                    deferred.resolveWith(null, [ws, port]);
                };
            } else {
                deferred.reject();
            }
        });
        
        return deferred.promise();
    }
    
    function NodeConnection() {
        if (!(this instanceof NodeConnection)) {
            return new NodeConnection();
        } else {
            this.domains = {};
            this._registeredModules = [];
            this._pendingInterfaceRefreshDeferreds = [];
            this._pendingCommandDeferreds = [];
            $(this).on("base.newDomains", this._refreshInterface.bind(this));
        }
    }
    
    NodeConnection.prototype.domains = null;
    
    NodeConnection.prototype._registeredModules = null;
    
    NodeConnection.prototype._ws = null;
    
    NodeConnection.prototype._port = null;
    
    NodeConnection.prototype._commandCount = 1;
    
    NodeConnection.prototype._autoReconnect = false;
    
    NodeConnection.prototype._pendingInterfaceRefreshDeferreds = null;
    
    NodeConnection.prototype._pendingCommandDeferreds = null;
    
    NodeConnection.prototype._cleanup = function () {
        // clear out the domains, since we may get different ones
        // on the next connection
        this.domains = {};
        
        // shut down the old connection if there is one
        if (this._ws && this._ws.readyState !== WebSocket.CLOSED) {
            try {
                this._ws.close();
            } catch (e) { }
        }
        var failedDeferreds = this._pendingInterfaceRefreshDeferreds
            .concat(this._pendingCommandDeferreds);
        failedDeferreds.forEach(function (d) {
            d.reject();
        });
        this._pendingInterfaceRefreshDeferreds = [];
        this._pendingCommandDeferreds = [];
        
        this._ws = null;
        this._port = null;
    };
    
    NodeConnection.prototype.connect = function (autoReconnect) {
        var self = this;
        self._autoReconnect = autoReconnect;
        var deferred = $.Deferred();
        var attemptCount = 0;
        var attemptTimestamp = null;
        
        // Called after a successful connection to do final setup steps
        function registerHandlersAndDomains(ws, port) {
            // Called if we succeed at the final setup
            function success() {
                self._ws.onclose = function () {
                    if (self._autoReconnect) {
                        self.connect(true);
                    } else {
                        self._cleanup();
                    }
                };
                deferred.resolve();
            }
            // Called if we fail at the final setup
            function fail() {
                self._cleanup();
                deferred.reject();
            }
            
            self._ws = ws;
            self._port = port;
            self._ws.onmessage = self._receive.bind(self);
            
            // refresh the current domains, then re-register any
            // "autoregister" modules
            self._refreshInterface().then(
                function () {
                    if (self._registeredModules.length > 0) {
                        self.loadDomains(self._registeredModules, false).then(
                            success,
                            fail
                        );
                    } else {
                        success();
                    }
                },
                fail
            );
        }
        
        // Repeatedly tries to connect until we succeed or until we've
        // failed CONNECTION_ATTEMPT times. After each attempt, waits
        // at least RETRY_DELAY before trying again.
        function doConnect() {
            attemptCount++;
            attemptTimestamp = new Date();
            attemptSingleConnect().then(
                registerHandlersAndDomains, // succeded
                function () { // failed this attempt, possibly try again
                    if (attemptCount < CONNECTION_ATTEMPTS) { //try again
                        // Calculate how long we should wait before trying again
                        var now = new Date();
                        var delay = Math.max(
                            RETRY_DELAY - (now - attemptTimestamp),
                            1
                        );
                        setTimeout(doConnect, delay);
                    } else { // too many attempts, give up
                        deferred.reject();
                    }
                }
            );
        }
        
        // Start the connection process
        self._cleanup();
        doConnect();

        return deferred.promise();
    };

    NodeConnection.prototype.connected = function () {
        return !!(this._ws && this._ws.readyState === WebSocket.OPEN);
    };

    NodeConnection.prototype.disconnect = function () {
        this._autoReconnect = false;
        this._cleanup();
    };
    
    NodeConnection.prototype.loadDomains = function (paths, autoReload) {
        var deferred = $.Deferred();
        setDeferredTimeout(deferred, CONNECTION_TIMEOUT);
        var pathArray = paths;
        if (!$.isArray(paths)) {
            pathArray = [paths];
        }
        
        if (autoReload) {
            Array.prototype.push.apply(this._registeredModules, pathArray);
        }

        if (this.domains.base && this.domains.base.loadDomainModulesFromPaths) {
            this.domains.base.loadDomainModulesFromPaths(pathArray).then(
                function (success) { // command call succeeded
                    if (!success) {
                        // response from commmand call was "false" so we know
                        // the actual load failed.
                        deferred.reject();
                    }
                    // if the load succeeded, we wait for the API refresh to
                    // resolve the deferred.
                },
                function () { // command call failed
                    deferred.reject();
                }
            );

            this._pendingInterfaceRefreshDeferreds.push(deferred);
        } else {
            deferred.reject();
        }
        
        return deferred;
    };
    
    NodeConnection.prototype._send = function (m) {
        if (this.connected()) {
            if (typeof m === "string") {
                this._ws.send(m);
            } else {
                this._ws.send(JSON.stringify(m));
            }
        } else {
            throw new Error(
                "NodeConnection not connected to node, unable to send."
            );
        }
    };

    
    NodeConnection.prototype._receive = function (message) {
        try {
            var responseDeferred = null;
            var m = JSON.parse(message.data);
            switch (m.type) {
            case "event":
                $(this).triggerHandler(m.message.domain + "." + m.message.event,
                                       m.message.parameters);
                break;
            case "commandResponse":
                responseDeferred = this._pendingCommandDeferreds[m.message.id];
                if (responseDeferred) {
                    responseDeferred.resolveWith(this, [m.message.response]);
                    delete this._pendingCommandDeferreds[m.message.id];
                }
                break;
            case "commandError":
                responseDeferred = this._pendingCommandDeferreds[m.message.id];
                if (responseDeferred) {
                    responseDeferred.rejectWith(
                        this,
                        [m.message.message, m.message.stack]
                    );
                    delete this._pendingCommandDeferreds[m.message.id];
                }
                break;
            case "error":
                console.error("[NodeConnection] received error: " +
                                m.message.message);
                break;
            default:
                console.error("[NodeConnection] unknown event type: " + m.type);
            }
        } catch (e) {
            console.error("[NodeConnection] received malformed message");
        }
    };
    
    NodeConnection.prototype._refreshInterface = function () {
        var deferred = $.Deferred();
        var self = this;
        
        var pendingDeferreds = this._pendingInterfaceRefreshDeferreds;
        this._pendingInterfaceRefreshDeferreds = [];
        deferred.then(
            function () {
                pendingDeferreds.forEach(function (d) { d.resolve(); });
            },
            function () {
                pendingDeferreds.forEach(function (d) { d.reject(); });
            }
        );
        
        function refreshInterfaceCallback(spec) {
            function makeCommandFunction(domainName, commandSpec) {
                return function () {
                    var deferred = $.Deferred();
                    var parameters = Array.prototype.slice.call(arguments, 0);
                    var id = self._commandCount++;
                    self._pendingCommandDeferreds[id] = deferred;
                    self._send({id: id,
                               domain: domainName,
                               command: commandSpec.name,
                               parameters: parameters
                               });
                    return deferred;
                };
            }
            
            // TODO: Don't replace the domain object every time. Instead, merge.
            self.domains = {};
            spec.forEach(function (domainSpec) {
                self.domains[domainSpec.domain] = {};
                domainSpec.commands.forEach(function (commandSpec) {
                    self.domains[domainSpec.domain][commandSpec.name] =
                        makeCommandFunction(domainSpec.domain, commandSpec);
                });
            });
            deferred.resolve();
        }
        
        if (this.connected()) {
            $.getJSON("http://localhost:" + this._port + "/api")
                .success(refreshInterfaceCallback)
                .error(function () { deferred.reject(); });
        } else {
            deferred.reject();
        }
        
        return deferred.promise();
    };
    
    module.exports = NodeConnection;
    
});
