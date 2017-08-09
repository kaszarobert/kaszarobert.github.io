var scanner;							// for Instascan.Scanner object. Necessary for QR detecting
var activeCamera;						// the selected Camera Module or Webcam where we use its picture for QR detecting algorythms
var isQrCheckingActive = false;			// calling scanner.start (or stop) more than 3x continously when its already started, causes errors. We have to store the current state - whether we are using the camera or not.
var SERVER = "http://ec2-13-59-110-85.us-east-2.compute.amazonaws.com:8080/";	// server for the API calls
var screens = {							// store which screens can be used in the webapp
		  LOGIN: 1,
		  LOGOUT: 2,
		  MAINMENU: 3,
		  SCANQR_ENTER: 4,
		  SCANQR_ENTER_PIN: 5,
		  SCANQR_EXIT: 6,
		  LISTSERVICES: 7,
		  SCANQR_USESERVICE: 8,
		  SCANQR_USESERVICE_PIN: 9
		};
var notificationStyles = {				// for setting the notification's appearance
		  SUCCESS: "success",
		  INFO: "info",
		  WARN: "warn",
		  ERROR: "error"
		};
var readQrData;							// this is the QR code which has been read
var selectedPrice = {};					// user selected this price to pay for in services list (price id, description, amount)
var currentScreen;						// the current view in the application
var authorizingInterval;				// to set an interval with REAUTHORIZE_TIME - for getting new tokens in background
var REAUTHORIZE_TIME = 1000 * 60 * 59;	// 59 minutes, and we must get a new token, because it'll expire

$(document).ready(function() {
	loadQrScanner();
	changeScreenLogin();
	assignAction();
});

/**
 * Hides all div elements with id other than the given parameter. 
 * @param {*} divId 
 */
function hideAllExcept(divId) {	
	$('#terminalWrapper div').not("#" + divId).hide();
	$("#" + divId).show();
}

/**
 * Assigning the listeners to HTML DOM elements
 */
function assignAction() {
	$("#loginBtn").click(function(e) {
        e.preventDefault();
		app_login($("#loginQr").val(), $("#loginPass").val(), $("#loginRefnum").val());
    });

	$("#exitBtn").click(function(e) {
		e.preventDefault();
		changeScreenExit();
    });
	
    $("#logoutBtn").click(function(e) {
		e.preventDefault();
		app_logout();
    });
	
	$("#enterBtn").click(function(e) {
        e.preventDefault();
		changeScreenEnter();
    });
	
	$("#szolgBtn").click(function(e) {
        e.preventDefault();
		changeScreenServicesList();
    });
	
	$("#enterSubmit").click(function(e) {
        e.preventDefault();
		app_sendEnterRequest(readQrData, $("#enterPass").val());
	});

	$("#serviceUseSubmit").click(function(e) {
		e.preventDefault();
		app_useService(readQrData, $("#serviceUsePass").val());
	});
	
	$(".backToMenu").click(function(e) {
        e.preventDefault();
		changeScreenMenu();
	});
}

function assignServicesListClickers() {
	// for drop-down in table
	$('.clicker').click(function(){
  		$(this).nextUntil('.clicker').slideToggle('normal');
	});

	// after clicking the selected price in services list,
	// we must open the qr code scanning.
	$("tr[id^='p']").each(function () {
		$(this).click(function() {
			//alert($(this).attr("id"));
			selectedPrice.id = $(this).attr("id").substring(1);
			selectedPrice.description = $(this).find(':first-child').text();
			selectedPrice.amount = $(this).find("td:nth-child(2)").text();;

			changeScreenServicesScanForQr();
		});
     });
}

/**
 * Initialize scanner - video element on the webpage that displays the camera's picture
 * and camera - from its picture we read the qr code
 */
function loadQrScanner() {
	scanner = new Instascan.Scanner({ video: document.getElementById('preview') });
    
	scanner.addListener('scan', function (content) {
		//$("#" + readQrDataInto).val(content);
		readQrData = content;
		
		switch(currentScreen) {
			case screens.SCANQR_ENTER :
				app_sendEnterRequest(content, "");
				break;
			case screens.SCANQR_EXIT:
				app_exit(content);
				break;
			case screens.SCANQR_USESERVICE:
				// ask user if he wants to pay
				if (askUserIsItOkToUseTheService(selectedPrice.amount, selectedPrice.description)) {
					changeScreenServicesEnterPin();
				}
				break;
		}
    });
    
    Instascan.Camera.getCameras().then(function (cameras) {
      if (cameras.length > 0) {
        //scanner.start(cameras[0]);
    	  activeCamera = cameras[0];
    	  //alert(activeCamera, cameras[0]);
      } else {
        console.error('No cameras found.');
      }
    }).catch(function (e) {
      console.error(e);
    });
}

/**
 * Start scanning QR from the camera.
 */
function startQrScanner() {
	if (!isQrCheckingActive) {
		scanner.start(activeCamera);
		isQrCheckingActive = true;
	}
}

/**
 * Stop scanning QR from the camera.
 */
function stopQrScanner() {
	if (isQrCheckingActive) {
		scanner.stop(activeCamera);
		isQrCheckingActive = false;
	}
}

/**
 * Screen change methods
 */

function changeScreenLogin() {
	hideAllExcept("terminalLoginScreen");
	currentScreen = screens.LOGIN;
	stopQrScanner();
	selectedPrice = {};
}

function changeScreenMenu() {
	stopQrScanner();
	hideAllExcept("terminalMenuScreen");
	currentScreen = screens.MAINMENU;
	readQrData = "";
	selectedPrice = {};
}

function changeScreenLogout() {
	changeScreenLogin();
}

function changeScreenEnter() {
	startQrScanner();
	hideAllExcept("qrScanPreview");
	currentScreen = screens.SCANQR_ENTER;
	readQrData = "";
}

function changeScreenEnterPin() {
	stopQrScanner();
	hideAllExcept("terminalEnterScreen");
	currentScreen = screens.SCANQR_ENTER_PIN;
}

function changeScreenExit() {
	startQrScanner();
	hideAllExcept("qrScanPreview");
	currentScreen = screens.SCANQR_EXIT;
	readQrData = "";
}

function changeScreenServicesList() {
	stopQrScanner();
	hideAllExcept("terminalPaidServicesScreen");
	currentScreen = screens.LISTSERVICES;
	selectedPrice = {};
	app_services();
}

function changeScreenServicesScanForQr() {
	startQrScanner();
	hideAllExcept("qrScanPreview");
	currentScreen = screens.SCANQR_USESERVICE;
	readQrData = "";
}

function changeScreenServicesEnterPin() {
	stopQrScanner();
	hideAllExcept("terminalUseServiceScreen");
	currentScreen = screens.SCANQR_USESERVICE_PIN;
}

/**
 * Shows a NotifyJS notification with the given message and style
 * @param {*} message 
 * @param {*} style 
 */
function showNotification(message, style) {
	$.notify(message, style);
}

/**
 * Methods that make the necessary REST API calls.
 */
/**
 * Login to the terminal.
 */
function app_login(qr, pass, ref) {
	var url = SERVER + "/qrsys/rest/rpi/terminallogin";
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
   				localStorage.setItem("Authorization", xhr.getResponseHeader("Authorization"));
   				localStorage.setItem("terminalReferenceNumber", xhr.responseJSON.terminal.referenceNumber);
				
				var message = "Terminal " + xhr.responseJSON.terminal.referenceNumber
					+ " logged in with account " + xhr.responseJSON.accountData.firstName
					+ " " + xhr.responseJSON.accountData.lastName;
				showNotification(message, notificationStyles.SUCCESS);

				changeScreenMenu();
				startBackGroundReAuthorizing();
				
		    }, function(xhr) {
				var message = xhr.responseJSON.errorMessage;
				showNotification(message, notificationStyles.ERROR);				
		    });
}

/**
 * Logout from the terminal
 */
function app_logout(){
	var url = SERVER + "/qrsys/rest/rpi/terminallogout";
	
    var req = {};
    req.terminalReferenceNumber = localStorage.getItem("terminalReferenceNumber");

    sendAjax("POST", 
    		url, 
    		JSON.stringify(req), 
    		function(xhr) {
    			xhr.setRequestHeader('Content-type', 'application/json; charset=UTF-8');
    			xhr.setRequestHeader('Authorization', localStorage.getItem("Authorization"));
    		},
    		function(data, textStatus, xhr) {
				var message = "Terminal " + xhr.responseJSON.referenceNumber
					+ " logged out successfully";
				showNotification(message, notificationStyles.SUCCESS);

    			localStorage.removeItem("Authorization");
				stopBackGroundReAuthorizing();
		    }, function(xhr) {
		    	var message = xhr.responseJSON.errorMessage;
				showNotification(message, notificationStyles.ERROR);	
		    });

	changeScreenLogout();
}

/**
 * Entering the terminal.
 * @param {*} qr 
 * @param {*} pass 
 */
function app_sendEnterRequest(qr, pass) {	
	var url = SERVER + "/qrsys/rest/rpi/enter";
    var req = {};
    req.qrCode = qr;
    req.pin = pass;
    req.terminalReferenceNumber = localStorage.getItem("terminalReferenceNumber");
    
    sendAjax("POST", 
    		url, 
    		JSON.stringify(req),
    		function(xhr) {
    			xhr.setRequestHeader('Content-type', 'application/json; charset=UTF-8');
    			xhr.setRequestHeader('Authorization', localStorage.getItem("Authorization"));
    		},
    		function(data, textStatus, xhr) {
				var message = xhr.responseJSON.accountData.firstName
					+ " " + xhr.responseJSON.accountData.lastName
					+ " entered successfully!";
				showNotification(message, notificationStyles.SUCCESS);

				localStorage.setItem("Authorization", xhr.getResponseHeader("Authorization"));
				changeScreenEnter();

		    }, function(xhr) {
				// the account needs to provide its password
				if (xhr.responseJSON.errorMessage.indexOf("Password is necessary") !== -1) {
					changeScreenEnterPin();
		    	} else {
					var message = xhr.responseJSON.errorMessage;
					showNotification(message, notificationStyles.ERROR);
		    		changeScreenEnter();
		    	}	
		    });	
}

/**
 * Exiting the terminal.
 * @param {*} qr 
 */
function app_exit(qr) {	
	var url = SERVER + "/qrsys/rest/rpi/exit";

    var req = {};
    req.qrCode = qr;
    req.terminalReferenceNumber = localStorage.getItem("terminalReferenceNumber");
    
    sendAjax("POST", 
    		url, 
    		JSON.stringify(req), 
    		function(xhr) {
    			xhr.setRequestHeader('Content-type', 'application/json; charset=UTF-8');
    			xhr.setRequestHeader('Authorization', localStorage.getItem("Authorization"));
    		},
    		function(data, textStatus, xhr) {
				var message = xhr.responseJSON.accountData.firstName
					+ " " + xhr.responseJSON.accountData.lastName
					+ " exited successfully!";
				showNotification(message, notificationStyles.SUCCESS);

				localStorage.setItem("Authorization", xhr.getResponseHeader("Authorization"));
				changeScreenExit();
		    	
		    }, function(xhr) {
				var message = xhr.responseJSON.errorMessage;
				showNotification(message, notificationStyles.ERROR);
		    	changeScreenExit();
		    });
}

/**
 * Listing available paid services
 */
function app_services() {
	var url = SERVER + "/qrsys/rest/rpi/paidservices";
	
    sendAjax("GET", 
    		url, 
    		null,     		 
    		function(xhr) {
    			xhr.setRequestHeader('Content-type', 'application/json; charset=UTF-8');
    			xhr.setRequestHeader('Authorization', localStorage.getItem("Authorization"));
    		},
    		function(data, textStatus, xhr) {
				localStorage.setItem("Authorization", xhr.getResponseHeader("Authorization"));
				var serviceList = xhr.responseJSON;

				$('#servicelist').empty();
				// load content to the table
				for (var i = 0; i < serviceList.length; i++) {
					
					var newServiceWithPrices = "<tr class=\"clicker\" id=\"s" + serviceList[i].id 
						+ "\"><td colspan=\"2\">"
						+ serviceList[i].title + "</td></tr>";
						
					for (var j = 0; j < serviceList[i].prices.length; j++) {
						currentPriceRow = "<tr id=\"p" + serviceList[i].prices[j].id
							+ "\" style=\"display: none;\"><td>" + serviceList[i].prices[j].description + 
							"</td><td>" + (-serviceList[i].prices[j].amount) + "</td></tr>";

						newServiceWithPrices += currentPriceRow;
					}
					$('#servicelist').append(newServiceWithPrices);
				}

				// assign clickers for making
				assignServicesListClickers();
				
		        	
		    }, function(xhr) {
				var message = xhr.responseJSON.errorMessage;
				showNotification(message, notificationStyles.ERROR);
		    });
}

/**
 * Request using the specified service.
 */
function app_useService(qr, pass) {	
	var url = SERVER + "/qrsys/rest/rpi/useservice";	
    var req = {};
    req.qrCode = qr;
    req.pin = pass;
    req.priceId = selectedPrice.id;
	req.terminalReferenceNumber = localStorage.getItem("terminalReferenceNumber");
    
    sendAjax("POST", 
    		url, 
    		JSON.stringify(req), 
    		function(xhr) {
    			xhr.setRequestHeader('Content-type', 'application/json; charset=UTF-8');
    			xhr.setRequestHeader('Authorization', localStorage.getItem("Authorization"));
    		},
    		function(data, textStatus, xhr) {
    	
				var message = "Using service " + selectedPrice.description
					+ " for " + xhr.responseJSON.accountData.firstName
					+ " " + xhr.responseJSON.accountData.lastName
					+ " is successful!";
				showNotification(message, notificationStyles.SUCCESS);

				localStorage.setItem("Authorization", xhr.getResponseHeader("Authorization"));
				changeScreenServicesScanForQr();
		        	
		    }, function(xhr) {
				var message = xhr.responseJSON.errorMessage;
				showNotification(message, notificationStyles.ERROR);
				changeScreenServicesScanForQr();
		    });
}

/**	
 * Is it ok to use the service?
 * @return true: OK, false: Cancel
 */
function askUserIsItOkToUseTheService(price, description) {
	return confirm("Are you sure you want to pay " + price + " for " + description + "?");
}

/**
 * Stop execution of the code for the given amount of miliseconds.
 * @param {*} milliseconds 
 */
function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

/**
 * Start getting new tokens after a given period
 */
function startBackGroundReAuthorizing() {
	authorizingInterval = setInterval(reAuthorize, REAUTHORIZE_TIME);
}

/**
 * Stop getting new tokens after a given period
 */
function stopBackGroundReAuthorizing() {
	clearInterval(authorizingInterval);
}

/**
 * Reauthorize, get a new token instead of the old one because the old is gonna expire!
 */
function reAuthorize(){
	console.log("Reauthorizing.");
	
	var url = SERVER + "/qrsys/rest/rpi/reauthorize";
	var req = {};
    req.terminalReferenceNumber = localStorage.getItem("terminalReferenceNumber");;
    
    sendAjax("POST", 
    		url, 
    		JSON.stringify(req), 
    		function(xhr) {
    			xhr.setRequestHeader('Content-type', 'application/json; charset=UTF-8');
    			xhr.setRequestHeader('Authorization', localStorage.getItem("Authorization"));
    		},
			null, 
			function(xhr) {
				var token = xhr.getResponseHeader("Authorization");
	    		if (token) {
	    			localStorage.setItem("Authorization", token);	
	    		}
		    });
}