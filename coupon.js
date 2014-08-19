var TerminalApp = {
    terminal_id: null,
    terminal_id_cron_interval: 3000,
    webSocket: null,
    switch_to_payment_interval: 20000,
    switch_to_payment_cron: null,
    url: "ws://vfilvgcepdev.verifone.com:9080/verifonecloud/v1/broadcastserver"
};

/*
 * Util function to generate random num between range
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
    if(TerminalApp.webSocket.readyState == 1){
        var send_data = {
            terminal_id: TerminalApp.terminal_id,
            terminal_status: "Open"
        };
        console.log("Sending data to server: " + JSON.stringify(send_data));
        TerminalApp.webSocket.send(JSON.stringify(send_data));
    } else {
        console.log("TerminalApp.send_id: webSocket not initialized");
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
        if(TerminalApp.webSocket.readyState == 1){
            clearInterval(TerminalApp.terminal_id_cron);
            console.log("TerminalApp.terminal_id_cron: Got terminal_id: " + TerminalApp.terminal_id);
            TerminalApp.send_id();  // Send terminal_id to server via socket
        } else {
            console.log("TerminalApp.terminal_id_cron: WebSocket not initialized")
        }
    } else {
        console.log("TerminalApp.terminal_id_cron: Retrying for terminal_id");
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

        TerminalApp.webSocket.onclose = function(e){
            console.log("webSocket.onclose: webSocket closed or error. Re-initializing...");

            // Re-initialize webSocket after 10-20 sec
            setTimeout(function(){
                TerminalApp.init_web_socket();
            },getRandomInt(5,10) * 1000);

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
        for(i=0;i<2000;i++){console.log("loop");}
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

/*
 * Create carousel effect
 */
function render_carousel(js_data, template){
    var carousel_template = template || "carousel_template";
    var template = $("#"+carousel_template).html();
    var render = Mustache.render(template,js_data.terminal_message);

    $("#container").html(render);

    $(".couponbutton").on("click",function(){
        var coupon_id = $(this).attr('coupon_id');

        // To toggle barcode when use coupon button is clicked
        $("#org_coupon_"+coupon_id).hide();
        $("#barcode_coupon_"+coupon_id).show();
    });

    this.options = {
                    $AutoPlay: false,

                    $PauseOnHover: true,                               //[Optional] Whether to pause when mouse over if a slideshow is auto playing, default value is false

                    $ArrowKeyNavigation: true,                          //Allows arrow key to navigate or not
                    $SlideWidth: 600,                                   //[Optional] Width of every slide in pixels, the default is width of 'slides' container
                    $SlideHeight: 298,                                  //[Optional] Height of every slide in pixels, the default is width of 'slides' container
                    $SlideSpacing: 10,                                  //Space between each slide in pixels
                    $DisplayPieces: 2,                                  //Number of pieces to display (the slideshow would be disabled if the value is set to greater than 1), the default value is 1
                    $ParkingPosition: 100,                                //The offset position to park slide (this options applys only when slideshow disabled).

                    $ArrowNavigatorOptions: {                       //[Optional] Options to specify and enable arrow navigator or not
                        $Class: $JssorArrowNavigator$,              //[Requried] Class to create arrow navigator instance
                        $ChanceToShow: 2,                               //[Required] 0 Never, 1 Mouse Over, 2 Always
                        $AutoCenter: 2,                                 //[Optional] Auto center arrows in parent container, 0 No, 1 Horizontal, 2 Vertical, 3 Both, default value is 0
                        $Steps: 1                                       //[Optional] Steps to go for each navigation request, default value is 1
                    }
                };

    var jssor_slider1 = new $JssorSlider$("slider1_container", options);

}

function add_banner(){
    var globalx = 800;
    var vector = -1;
    var interval = 120;
    var canvas = document.getElementById('bannershow');
    var ctx = canvas.getContext('2d');
    var fontsize = 25;
    var canvasHeight = 40;
    var canvasWidth = 800;

    function banner(label) {

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);    
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect (0, 0, canvasWidth, canvasHeight);

        ctx.fillStyle = 'white'
        ctx.font = fontsize + 'px Helvetica';
        ctx.textBaseline = 'top';
        if (globalx < 0 - ctx.measureText(label).width) {
             globalx = canvasWidth;
        }                        
        ctx.fillText(label, globalx, (canvasHeight-fontsize)/2);

        globalx += vector;
    }
    setInterval(banner, 1000/interval, 'test test test');   
}

$(function() {
    Coupon.renderHomePage();

    init_testing_setup();
    $("#no_thanks").click(function(){
        TerminalApp.switchToPayment();
    })

    TerminalApp.init();

    render_carousel(test_data);
    add_banner();
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