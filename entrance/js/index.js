var scanner;							// for Instascan.Scanner object. Necessary for QR detecting
var activeCamera;						// the selected Camera Module or Webcam where we use its picture for QR detecting algorythms
var isQrCheckingActive = false;			// calling scanner.start (or stop) more than 3x continously when its already started, causes errors. We have to store the current state - whether we are using the camera or not.
var SERVER = "https://qrsys.ddns.net";	// server for the API calls: https://qrsys.ddns.net
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
var darkMode = false;					// store that which theme is being used, so we can easily switch with a function
var styles;								// possible styles = light and dark

$(document).ready(function() {
	initStyle();
	loadQrScanner();
	
	// temporary: we dont store tokens for automatic logins
	// changeScreenLogin();

	tryToAuthenticateAutomatically();
	assignAction();
});

function tryToAuthenticateAutomatically() {
	var terminalReferenceNumber = getTerminalRefNumberFromToken();

	if (terminalReferenceNumber == "") {
		// if there is no token stored - simply just show the login page 
		removeStoredData();
		changeScreenLogin();
	} else {
		// trying to reauthenticate automatically with that token and terminal number
		// check if this token is valid?
		var url = SERVER + "/qrsys/rest/rpi/reauthorize";
		var req = {};
		req.terminalReferenceNumber = terminalReferenceNumber;
		
		sendAjax("POST", 
				url, 
				JSON.stringify(req), 
				function(xhr) {
					xhr.setRequestHeader('Authorization', getStoredData("Authorization"));
				},
				null, 
				function(xhr) {
					if (xhr.status == 200) {
						var token = xhr.getResponseHeader("Authorization");
						if (token) {
							setStoredData("Authorization", token);
						}
						// if it is valid, user can continue working. No need to log in again
						startBackGroundReAuthorizing();
						changeScreenMenu();
		
					} else {
						// token is not valid - remove useless entries, and serve the login page to the user
						removeStoredData();
						changeScreenLogin();
					}
				});
		}
}

function getTerminalRefNumberFromToken() {
	var token = getStoredData("Authorization");
	
	// if there is no token stored
	if (token == null || token == "") {
		return "";

	} else {
		// trying to decode that token
		// {iss: "qrsys", aud: "BEJARAT1", exp: 1504202239, iat: 1504198639}
		try {
			var decoded = jwt_decode(token);
		} catch (e) {
			return "";
		}

		// return the terminal's number
		return decoded.aud;
	}
}

function initStyle() {
	styles = {
        light: $("#light"),
        dark:  $("#dark")
	  };
	  
	// temporary solution: set to white
	//$("#dark").detach(); darkMode = false;

	// check if the used theme is saved in the browser
	var useDarkTheme = getStoredData("DARKTHEME");

	if (useDarkTheme == "") {
		// nothing has been set, we use light theme
		$("#dark").detach();
		darkMode = false;
		// and we're saving that
		setStoredData("DARKTHEME", darkMode);

	} else if (useDarkTheme == "true") {
		// then we must use dark theme
		$("#light").detach();
		darkMode = true;

	} else {
		// then we must use light theme
		$("#dark").detach();
		darkMode = false;
	}
	
}

function switchToTheOtherStyle() {
	if (darkMode) {
		// then switch to Light Mode
		$("#dark").detach();
		styles.light.appendTo("head");
	} else {
		// switch to Dark Mode
		$("#light").detach();
		styles.dark.appendTo("head");
	}

	darkMode = !darkMode;
	setStoredData("DARKTHEME", darkMode);
}

/**
 * Hides all div elements with id other than the given parameter. 
 * @param {*} divId 
 */
function hideAllExcept(divId, menuVisible) {	
	$('#terminalWrapper div').not("#" + divId).hide();
	$("#" + divId).show();
	$("#themeChoosing").show();

	if (menuVisible) {
		$("#terminalMenuBackButton").show();
	} else {
		$("#terminalMenuBackButton").hide();
	}
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
	
	$("#backToMenu").click(function(e) {
        e.preventDefault();
		changeScreenMenu();
	});

	$("#setOtherTheme").click(function(e) {
		e.preventDefault();
		switchToTheOtherStyle();
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
	hideAllExcept("terminalLoginScreen", false);
	currentScreen = screens.LOGIN;
	stopQrScanner();
	selectedPrice = {};
}

function changeScreenMenu() {
	stopQrScanner();
	hideAllExcept("terminalMenuScreen", false);
	currentScreen = screens.MAINMENU;
	readQrData = "";
	selectedPrice = {};
}

function changeScreenLogout() {
	changeScreenLogin();
}

function changeScreenEnter() {
	startQrScanner();
	hideAllExcept("qrScanPreview", true);
	currentScreen = screens.SCANQR_ENTER;
	readQrData = "";
}

function changeScreenEnterPin() {
	stopQrScanner();
	hideAllExcept("terminalEnterScreen", true);
	currentScreen = screens.SCANQR_ENTER_PIN;
}

function changeScreenExit() {
	startQrScanner();
	hideAllExcept("qrScanPreview", true);
	currentScreen = screens.SCANQR_EXIT;
	readQrData = "";
}

function changeScreenServicesList() {
	stopQrScanner();
	hideAllExcept("terminalPaidServicesScreen", true);
	currentScreen = screens.LISTSERVICES;
	selectedPrice = {};
	app_services();
}

function changeScreenServicesScanForQr() {
	startQrScanner();
	hideAllExcept("qrScanPreview", true);
	currentScreen = screens.SCANQR_USESERVICE;
	readQrData = "";
}

function changeScreenServicesEnterPin() {
	stopQrScanner();
	hideAllExcept("terminalUseServiceScreen", true);
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
    		null,
    		function(data, textStatus, xhr) {
				setStoredData("Authorization", xhr.getResponseHeader("Authorization"));				
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
    req.terminalReferenceNumber = getTerminalRefNumberFromToken();

	if (req.terminalReferenceNumber == "") {
		changeScreenLogin();
		removeStoredData();
	} else {
		sendAjax("POST", 
				url, 
				JSON.stringify(req), 
				function(xhr) {
					xhr.setRequestHeader('Authorization', getStoredData("Authorization"));
				},
				function(data, textStatus, xhr) {
					var message = "Terminal " + xhr.responseJSON.referenceNumber
						+ " logged out successfully";
					showNotification(message, notificationStyles.SUCCESS);

					removeStoredData();
					stopBackGroundReAuthorizing();
				}, function(xhr) {
					var message = xhr.responseJSON.errorMessage;
					showNotification(message, notificationStyles.ERROR);	
				});

		changeScreenLogout();
	}

	
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
    req.terminalReferenceNumber = getTerminalRefNumberFromToken();
	
	if (req.terminalReferenceNumber == "") {
		changeScreenLogin();
		removeStoredData();
	} else {
		sendAjax("POST", 
    		url, 
    		JSON.stringify(req),
    		function(xhr) {
    			xhr.setRequestHeader('Authorization', getStoredData("Authorization"));
    		},
    		function(data, textStatus, xhr) {
				var message = xhr.responseJSON.accountData.firstName
					+ " " + xhr.responseJSON.accountData.lastName
					+ " entered successfully!";
				showNotification(message, notificationStyles.SUCCESS);

				setStoredData("Authorization", xhr.getResponseHeader("Authorization"));
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
    
}

/**
 * Exiting the terminal.
 * @param {*} qr 
 */
function app_exit(qr) {	
	var url = SERVER + "/qrsys/rest/rpi/exit";

    var req = {};
    req.qrCode = qr;
    req.terminalReferenceNumber = getTerminalRefNumberFromToken();
	
	if (req.terminalReferenceNumber == "") {
		changeScreenLogin();
		removeStoredData();		
	} else {
		sendAjax("POST", 
    		url, 
    		JSON.stringify(req), 
    		function(xhr) {
    			xhr.setRequestHeader('Authorization', getStoredData("Authorization"));
    		},
    		function(data, textStatus, xhr) {
				var message = xhr.responseJSON.accountData.firstName
					+ " " + xhr.responseJSON.accountData.lastName
					+ " exited successfully!";
				showNotification(message, notificationStyles.SUCCESS);

				setStoredData("Authorization", xhr.getResponseHeader("Authorization"));
				changeScreenExit();
		    	
		    }, function(xhr) {
				var message = xhr.responseJSON.errorMessage;
				showNotification(message, notificationStyles.ERROR);
		    	changeScreenExit();
		    });
	}

}

/**
 * Listing available paid services
 */
function app_services() {
	$('#servicelist').empty();
	var url = SERVER + "/qrsys/rest/rpi/paidservices";
	var token = getStoredData("Authorization");
	
	if (token == "" || token == null) {
		changeScreenLogin();
		removeStoredData();	
	} else {
		sendAjax("GET", 
			url, 
			null,     		 
			function(xhr) {
				xhr.setRequestHeader('Authorization', getStoredData("Authorization"));
			},
			function(data, textStatus, xhr) {
				setStoredData("Authorization", xhr.getResponseHeader("Authorization"));
				var serviceList = xhr.responseJSON;
				
				// load content to the table
				for (var i = 0; i < serviceList.length; i++) {
					
					var newServiceWithPrices = "<tr class=\"clicker\" id=\"s" + serviceList[i].id 
						+ "\"><td colspan=\"2\">"
						+ serviceList[i].title + "</td></tr>";
						
					for (var j = 0; j < serviceList[i].prices.length; j++) {
						currentPriceRow = "<tr class=\"bg-primary\" id=\"p" + serviceList[i].prices[j].id
							+ "\" style=\"display: none;\"><td>" + serviceList[i].prices[j].description + 
							"</td><td>" + (-serviceList[i].prices[j].amount) + "</td></tr>";

						newServiceWithPrices += currentPriceRow;
					}
					$('#servicelist').append("<tbody>" + newServiceWithPrices + "</tbody>");
				}

				// assign clickers for making
				assignServicesListClickers();
				
					
			}, function(xhr) {
				var message = xhr.responseJSON.errorMessage;
				showNotification(message, notificationStyles.ERROR);
			});
	}
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
	req.terminalReferenceNumber = getTerminalRefNumberFromToken();
	
	if (req.terminalReferenceNumber == "") {
		changeScreenLogin();
		removeStoredData();			
	} else {
		sendAjax("POST", 
			url, 
			JSON.stringify(req), 
			function(xhr) {
				xhr.setRequestHeader('Authorization', getStoredData("Authorization"));
			},
			function(data, textStatus, xhr) {
		
				var message = "Using service " +xhr.responseJSON.priceDescription
					+ " for " + xhr.responseJSON.firstName
					+ " " + xhr.responseJSON.lastName
					+ " is successful!";
				showNotification(message, notificationStyles.SUCCESS);

				setStoredData("Authorization", xhr.getResponseHeader("Authorization"));
				changeScreenServicesScanForQr();
					
			}, function(xhr) {
				var message = xhr.responseJSON.errorMessage;
				showNotification(message, notificationStyles.ERROR);
				changeScreenServicesScanForQr();
			});
	}
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
    req.terminalReferenceNumber = getTerminalRefNumberFromToken();

	if (req.terminalReferenceNumber == "") {
		changeScreenLogin();
		removeStoredData();			
	} else {
		sendAjax("POST", 
				url, 
				JSON.stringify(req), 
				function(xhr) {
					xhr.setRequestHeader('Authorization', getStoredData("Authorization"));
				},
				null, 
				function(xhr) {
					var token = xhr.getResponseHeader("Authorization");
					if (token) {
						setStoredData("Authorization", token);
					}
				});
	}
}

/**
 * Method for setting cookies
 * @param {*} cname
 * @param {*} cvalue 
 * @param {*} exdays 
 */
function setCookie(cname, cvalue, exdays) {
	var expires = "";

	if (cvalue != 0 && cvalue != "0") {
		var d = new Date();
		d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
		expires = "expires=" + d.toUTCString() + ";";		
	}
	document.cookie = cname + "=" + cvalue + ";" + expires + "path=/";
}

/**
 * Get the stored cookie with the requested name. It returns empty string
 * if there's no cookie with the given name
 * @param {*} cname 
 */
function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

/**
 * Removes a requested cookie
 * @param {*} name 
 */
function delete_cookie( name ) {
	document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }

// methods for storing things in the browser
function setStoredData(name, value) {
	localStorage.setItem(name, value);
}

function getStoredData(name) {
	return localStorage.getItem(name);
}

function removeStoredData() {
	localStorage.removeItem("Authorization")
}

function removeAllStoredDataForThisWebsite() {
	localStorage.clear();
}