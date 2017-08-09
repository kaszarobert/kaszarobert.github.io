//this general function sends an ajax call to the server
//parameters:
//method - the type of the call: POST, PUT, GET, DELETE
//url - the requested url
//data - the sent data, this fields is used only if the method is POST or PUT
//beforeSendCallback - this function is called before sending the request. this is used for setting the headers of the request
//successCallback - this function is called when the request returned with a successful response
//errorCallback - this function is called when the request returned with an error response
function sendAjax(method, url, data, beforeSendCallback, successCallback, errorCallback) {
	// shift arguments if data argument was omitted
	if ( $.isFunction( data ) ) {
		errorCallback = successCallback;
		successCallback = data;
		data = null;
	}
	
	return $.ajax({		
		type: method,
		beforeSend: beforeSendCallback,
		dataType: 'json',
		contentType: "application/json;charset=utf-8",
		url: url,
		data: data,
		cache: false,
		timeout: 30000,
		ifModified: false,
		success: successCallback,		
		error: errorCallback
	});
}

/*
var beforeSendCallback = function(xhr){
	var headers = {};
	headers["Content-type"] = "application/json; charset=UTF-8";
}
*/
function getErrorMsg(xhr) {
	var errorMsg;			
	if (xhr.status == 0) {
		errorMsg = "The server is not responding or is not reachable.";
	} else {
		errorMsg = (xhr.statusText != "")? xhr.responseText : xhr.response;
	}
	console.log(errorMsg);
	return errorMsg;
}
