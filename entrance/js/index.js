$(document).ready(function() {
	assignAction();
});

function assignAction() {
    $("#loginBtn").click(function(e) {
        e.preventDefault();
		login($("#qr").val(), $("#pass").val(), $("#refnum").val());
    });
	
	getSentJson();
	$(":input").on("change paste keyup", function() {getSentJson(); });
}


function login(qr, pass, ref) {
	
	var url = "/qrsys/rest/rpi/terminallogin";

    var req = {};
    req.qrCode = qr;
    req.pin = pass;
    req.terminalReferenceNumber = ref;
    
    sendAjax("POST", 
    		url, 
    		JSON.stringify(req), 
    		function(xhr) {
    			xhr.setRequestHeader('Content-type', 'application/json; charset=UTF-8');
    		},
    		function(data, textStatus, xhr) {

				$("#receivedjson").html(JSON.stringify(xhr.responseJSON, null, "\t"));
				$("#status").html(xhr.status);
				$("#auth").val(xhr.getResponseHeader("Authorization"));
				$("#tovabb").html("<a href=\"choose.html?token=" 
						+ xhr.getResponseHeader("Authorization") +"\">Tovább</a>");
				setMenuButtons(xhr.getResponseHeader("Authorization"));
				
		    }, function(xhr) {
				$("#receivedjson").html(JSON.stringify(xhr.responseJSON, null, "\t"));
				$("#status").html(xhr.status);
				$("#auth").val("");
		    });
}

function getSentJson(){
	var req = {};
    req.qrCode = $("#qr").val();
    req.pin = $("#pass").val();
    req.terminalReferenceNumber = $("#refnum").val();
    
	$("#sentjson").html(JSON.stringify(req, null, "\t"));
}