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
/*global $, define, brackets, setInterval, clearInterval */

define(function (require, exports, module) {
    "use strict";

    var AppInit        = brackets.getModule("utils/AppInit"),
        Menus          = brackets.getModule("command/Menus"),
        CommandManager = brackets.getModule("command/CommandManager"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
    
    // Hang NodeConnection constructor off of brackets so that other
    // extensions can access it
    var NodeConnection = brackets.NodeConnection = require("NodeConnection");
    
    var _nodeConnection = null;
    var _nodeLog = [];

    function showNodeState() {
        if (brackets.app && brackets.app.getNodeState) {
            brackets.app.getNodeState(function (err, port) {
                if (err) {
                    alert("Node is in error state " + err);
                } else {
                    alert("Node is listening on port " + port);
                }
            });
        } else {
            alert("No getNodeState. Maybe you're running the wrong shell?");
        }
    }
    
    function restart() {
        try {
            _nodeConnection.domains.base.restartNode();
        } catch (e) {
            alert("Failed trying to restart Node: " + e.message);
        }
    }
    
    function enableDebugger() {
        try {
            _nodeConnection.domains.base.enableDebugger();
        } catch (e) {
            alert("Failed trying to enable Node debugger: " + e.message);
        }
    }
    
    function showLog() {
        alert(JSON.stringify(_nodeLog, null, "  "));
    }
    
    AppInit.appReady(function () {
        _nodeConnection = new NodeConnection();
        _nodeConnection.connect(true);
        $(_nodeConnection).on(
            "base.log",
            function (evt, level, timestamp, message) {
                _nodeLog.push({
                    level: level,
                    timestamp: timestamp,
                    message: message
                });
            }
        );
        
        var ID_NODE_SHOW_STATE        = "brackets.node.showState";
        var NAME_NODE_SHOW_STATE      = "Show Node State";
        
        var ID_NODE_RESTART           = "brackets.node.restart";
        var NAME_NODE_RESTART         = "Restart Node";
        
        var ID_NODE_ENABLE_DEBUGGER   = "brackets.node.enableDebugger";
        var NAME_NODE_ENABLE_DEBUGGER = "Enable Node Debugger";
        
        var ID_NODE_SHOW_LOG          = "brackets.node.showLog";
        var NAME_NODE_SHOW_LOG        = "Show Node Log";
        
        CommandManager.register(
            NAME_NODE_SHOW_STATE,
            ID_NODE_SHOW_STATE,
            showNodeState
        );
        CommandManager.register(
            NAME_NODE_RESTART,
            ID_NODE_RESTART,
            restart
        );
        CommandManager.register(
            NAME_NODE_ENABLE_DEBUGGER,
            ID_NODE_ENABLE_DEBUGGER,
            enableDebugger
        );
        CommandManager.register(
            NAME_NODE_SHOW_LOG,
            ID_NODE_SHOW_LOG,
            showLog
        );
        
        var menu = Menus.getMenu(Menus.AppMenuBar.DEBUG_MENU);
        menu.addMenuItem(Menus.DIVIDER);
        menu.addMenuItem(ID_NODE_SHOW_STATE);
        menu.addMenuItem(ID_NODE_RESTART);
        menu.addMenuItem(ID_NODE_ENABLE_DEBUGGER);
        menu.addMenuItem(ID_NODE_SHOW_LOG);
        
    });

});
