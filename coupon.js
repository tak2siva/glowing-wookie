/**
 * JS stlye Coupon class
 * intializer attributes           
 * @attribute => html container
 * @attribute => data (optional)                      
 */
function Coupon(container,data){
  this.data = data;
  this.container = container;          
}

/**
 * Object method
 * gets JSON 
 * @param => url
 * @param => callback function to exec after json loaded (i.e) renderView
 */
Coupon.prototype.getJSON = function(url, callback){
  var proxy = this;     // Preserve scope

  $.getJSON(url, function(data){
    proxy.data = data;
    callback();
  }).fail(function(a,b,c){
    alert("Cant load " + url)
  });
}

/*
 * Set JSON obj directly instead of URL
 * @param => JSON object
 */
Coupon.prototype.setJSON = function(data){
  this.data = data;
}

/**
 * render the json data as html
 * @param => template_id 
 */
Coupon.prototype.renderView = function(template_id){
  /** 
   *  Need modifications if input is Array of JSON  
  */          
  var template = $("#template_"+ (template_id || this.data.template_id)).html();
  if(!template){
    console.log("Template " + (template_id || this.data.template_id) + "does not exist");
    return false;
  }
  var render_html = Mustache.render(template, this.data);
  $("#"+this.container).html(render_html);
}

/*
 * kind of static method to render home page
 */
Coupon.renderHomePage = function(){
  var template = $("#template_0").html();
  Mustache.parse(template);
  $("#container").html(Mustache.render(template));
}

$(function(){
    /**
     * Start here on document ready
     */
     Coupon.renderHomePage();

     var terminal_id;
     var webSocket;

     var sys_call_back = function(obj){	  
      terminal_id = obj.val.serialNumber.val;

	    console.log("obj stringify: " + JSON.stringify(obj));
	    console.log("terminal id: " + terminal_id);

      webSocket = new WebSocket("ws://localhost:8090"); // Init socket after getting terminal id
     }

     _svc.sysInfo.platform(sys_call_back); // Get terminal id      

     webSocket.onopen = function(){
      var send_data = {
        terminal_id: terminal_id,
        terminal_status: "Open"
      };
      webSocket.send(JSON.stringify(send_data));      
     }

     webSocket.onmessage = function(e) {
      console.log("Server : " + e.data);

      var jsonObj;

      try{
        jsonObj = JSON.parse(e.data);   // parse string to JSON Obj
      } catch(error){
        console.log(error.message);
      }

      if(jsonObj){
        var coupon = new Coupon("container", jsonObj);
        coupon.renderView();
      }

     }
    
}); 