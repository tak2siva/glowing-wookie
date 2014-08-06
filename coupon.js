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


var terminal_id;

function init() {

    var sys_call_back = function(obj) {
        console.log("object is:" + JSON.stringify(obj));
        terminal_id = obj.val.serialNumber.val;
        console.log("terminal id: " + terminal_id);
    }

    _svc.sysInfo.platform(sys_call_back); // Get terminal id

    socketIO();
}


function socketIO() {

    //var webSocket = new WebSocket("wss://vfilvgcepdev.verifone.com:9443/verifonecloud/v1/broadcastserver");
    var webSocket = new WebSocket("ws://vfilvgcepdev.verifone.com:9080/verifonecloud/v1/broadcastserver");
    var init_timeout;

    webSocket.onopen = function() {
        var send_data = {
            terminal_id: terminal_id,
            terminal_status: "Open"
        };
        console.log("Data sent to the server:" + JSON.stringify(send_data));
        webSocket.send(JSON.stringify(send_data));
        init_timeout = window.setTimeout(timeout1, 60000); // To swtich to payment app when no data from server for 60 sec
    }


    webSocket.onmessage = function(e) {
        //console.log("Server : " + e.data);

        if(init_timeout){
          clearTimeout(init_timeout);
          init_timeout = null;
        }

        var jsonObj;

        try {
            jsonObj = JSON.parse(e.data); // parse string to JSON Obj
        } catch (error) {
            console.log(error.message);
        }

        if (jsonObj) {
            switchToBrowser();
            var coupon = new Coupon("container", jsonObj);
            console.log("Rendering coupon page");
            coupon.renderView();
            window.setTimeout(timeout1, 60000);
        } else {
      switchToPayment();
      window.setTimeout(timeout2, 60000);
    }

    }

}

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