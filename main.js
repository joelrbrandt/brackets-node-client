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


/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets */

define(function (require, exports, module) {
    "use strict";

    var AppInit = brackets.getModule("utils/AppInit"),
        Menus = brackets.getModule("command/Menus"),
        CommandManager = brackets.getModule("command/CommandManager");
    

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
    
    // load everything when brackets is done loading
    AppInit.appReady(function () {
        var ID_SHOW_NODE_STATE = "jrb.node.showNodeState";
        var NAME_SHOW_NODE_STATE = "Show Node State";

        CommandManager.register(NAME_SHOW_NODE_STATE, ID_SHOW_NODE_STATE, showNodeState);
        
        var menu = Menus.getMenu(Menus.AppMenuBar.DEBUG_MENU);
        menu.addMenuItem(Menus.DIVIDER);
        menu.addMenuItem(ID_SHOW_NODE_STATE);
        
    });

});
