var TerminalApp = {
    terminal_id: null,
    terminal_id_cron_interval: 3000,
    webSocket: null,
    switch_to_payment_interval: 20000,
    switch_to_payment_cron: null,
    url: "ws://vfilvgcepdev.verifone.com:9080/verifonecloud/v1/broadcastserver"
};

function Coupon(container, data) {
    this.data = data;
    this.container = container;
}

/**
 * Object method
 * gets JSON
 * @param => url
 * @param => callback function to exec after json loaded (i.e) renderView
 */
Coupon.prototype.getJSON = function(url, callback) {
    var proxy = this; // Preserve scope

    $.getJSON(url, function(data) {
        proxy.data = data;
        callback();
    }).fail(function(a, b, c) {
        alert("Cant load " + url)
    });
}

/*
 * Set JSON obj directly instead of URL
 * @param => JSON object
 */
Coupon.prototype.setJSON = function(data) {
    this.data = data;
}

/**
 * render the json data as html
 * @param => template_id
 */
Coupon.prototype.renderView = function(template_id) {
    /** 
     *  Need modifications if input is Array of JSON
     */
    var template = $("#template_" + (template_id || this.data.template_id)).html();
    if (!template) {
        console.log("Template " + (template_id || this.data.template_id) + "does not exist");
        return false;
    }
    var render_html = Mustache.render(template, this.data);
    $("#" + this.container).html(render_html);
}

/*
 * kind of static method to render home page
 */
Coupon.renderHomePage = function() {
    var template = $("#template_0").html();
    Mustache.parse(template);
    $("#container").html(Mustache.render(template));
}

TerminalApp.get_terminal_id = function(){

    console.log("Getting terminal_id..");

    var sys_call_back = function(obj) {
        TerminalApp.terminal_id = obj.val.serialNumber.val;
    }

    _svc.sysInfo.platform(sys_call_back); // Get terminal id
}

TerminalApp.send_id = function(){
    if(TerminalApp.webSocket){
        var send_data = {
            terminal_id: TerminalApp.terminal_id,
            terminal_status: "Open"
        };
        console.log("Sending data to server: " + JSON.stringify(send_data));
        TerminalApp.webSocket.send(JSON.stringify(send_data));
    } else {
        console.log("webSocket not initialized");
        return false;
    }
}

TerminalApp.switchToPayment = function(){
    var cb = function() {
        opera.postError("Go complete.");
    };
    opera.postError("pressed Go.");
    TerminalApp.callPHP('php-switchToPayment.php', '<empty/>', cb);
}

TerminalApp.switchToBrowser = function(){
    var cb = function() {
        opera.postError("Go complete Browser App.");
    };
    opera.postError("pressed Go.");
    TerminalApp.callPHP('php-switchToBrowser.php', '<empty/>', cb);
}

TerminalApp.callPHP = function callPHP(url, xmlOut, cb) {
    var localCB = function(root, cb) {
        cb(root);
    };

    var xhReq = new XMLHttpRequest();
    xhReq.open("POST", url, true);
    xhReq.setRequestHeader("Content-Type", "application/xml;");
    xhReq.onreadystatechange = function() {
        if (xhReq.readyState != 4) return;
        if (xhReq.status == 200) {
            opera.postError("<<" + xhReq.responseText);
            if (xhReq.responseXML) {
                var root = xhReq.responseXML.documentElement;
                localCB(root, cb);
            }
        } else {
            opera.postError("error(" + url + ") == " + xhReq.status);
        }
    }
    opera.postError(">>" + xmlOut);

    xhReq.send(xmlOut);
}

/**
 * This is a long polling checks every 3 sec for terminal_id
 * Once detected it will be sent and polling will be destroyed   
 */
TerminalApp.terminal_id_cron = setInterval(function(){
    if(TerminalApp.terminal_id){
        clearInterval(TerminalApp.terminal_id_cron);
        console.log("Got terminal_id: " + TerminalApp.terminal_id);
        TerminalApp.send_id();  // Send terminal_id to server via socket
    } else {
        console.log("Retrying for terminal_id");
    }
},TerminalApp.terminal_id_cron_interval);

// Init timout for switch to payment in 20 sec
TerminalApp.init_payment_cron = function(){
    if(!TerminalApp.switch_to_payment_cron){
        TerminalApp.switch_to_payment_cron = setTimeout(function(){
            console.log("Switching to payment app");
            TerminalApp.switchToPayment();
        },TerminalApp.switch_to_payment_interval);
    }
}

// Reset switch to payment timout
TerminalApp.reset_payment_cron = function(){
    clearTimeout(TerminalApp.switch_to_payment_cron);
    TerminalApp.switch_to_payment_cron = null;
    TerminalApp.init_payment_cron();
}

TerminalApp.init_web_socket = function(url){
    TerminalApp.webSocket = new WebSocket(url || TerminalApp.url);
    TerminalApp.init_web_socket_events();
}

TerminalApp.init_web_socket_events = function(){
    if(TerminalApp.webSocket){
        // On message event
        TerminalApp.webSocket.onmessage = function(e){
            var jsonObj;
            try {
                jsonObj = JSON.parse(e.data); // parse string to JSON Obj

            } catch (error) {
                console.log(error.message);
            }

            if(jsonObj){
                TerminalApp.switchToBrowser(); // Please check if required ?

                var coupon = new Coupon("container", jsonObj);
                console.log("Rendering coupon page");
                coupon.renderView();

                TerminalApp.reset_payment_cron(); // Reset 20 sec timeout after every msg
            }
        }
    }
}

/*
 * Only for testing purpose
 */
function init_testing_setup(){
    window._svc = {};
    _svc.sysInfo = { platform : function(a){
        console.log("Called _svc system callback in test");
        for(i=0;i<5000;i++){console.log("loop");}
            TerminalApp.terminal_id =123123;
    }}
  //  _svc.sysInfo.platform(); // Get terminal id
    TerminalApp.url = "ws://localhost:8090"
    TerminalApp.switchToBrowser = function(){
        console.log("called switchToBrowser");
    }
    TerminalApp.switchToPayment = function(){
        console.log("called switchToPayment");
    }
}

TerminalApp.init = function(){
    TerminalApp.init_web_socket();
    TerminalApp.get_terminal_id();
    TerminalApp.init_payment_cron();    
}

$(function() {
    Coupon.renderHomePage();

    //init_testing_setup();
    $("#no_thanks").click(function(){
        TerminalApp.switchToPayment();
    })

    TerminalApp.init();
});


/*===================================================================================*/
/*
function switchToPayment() {
    var cb = function() {
        opera.postError("Go complete.");
    };
    opera.postError("pressed Go.");
    callPHP('php-switchToPayment.php', '<empty/>', cb);
}

function switchToBrowser() {
    var cb = function() {
        opera.postError("Go complete Browser App.");
    };
    opera.postError("pressed Go.");
    callPHP('php-switchToBrowser.php', '<empty/>', cb);
}


function callPHP(url, xmlOut, cb) {
    var localCB = function(root, cb) {
        cb(root);
    };

    var xhReq = new XMLHttpRequest();
    xhReq.open("POST", url, true);
    xhReq.setRequestHeader("Content-Type", "application/xml;");
    xhReq.onreadystatechange = function() {
        if (xhReq.readyState != 4) return;
        if (xhReq.status == 200) {
            opera.postError("<<" + xhReq.responseText);
            if (xhReq.responseXML) {
                var root = xhReq.responseXML.documentElement;
                localCB(root, cb);
            }
        } else {
            opera.postError("error(" + url + ") == " + xhReq.status);
        }
    }
    opera.postError(">>" + xmlOut);

    xhReq.send(xmlOut);
}

function timeout1() {
    switchToPayment();
    console.log("Now i am in Payment Page");
    //window.setTimeout(timeout2, 60000);
}

function timeout2() {
    switchToBrowser();
    console.log("Coupon Page");
   // window.setTimeout(timeout1, 60000);
}

$(function() {

    Coupon.renderHomePage();

    init();

});

*/