/*
 uJumbo (micro Jumbo) is micro Angular like JS framework.

 This micro framework should NOT replace frameworks nor libraries like Angular or React.

 This FW's major point is SPA, without client side or server side editation,
 all full automatic, you just create controller and mark some page parts with data attributes.
 */

var uJumbo = (function () {

	if (!console.debug) console.debug = function () {
		var args = Array.prototype.slice.call(arguments);
		args.unshift("[DEBUG]");
		console.log.apply(null, args);
	};

	//region Helper functions

	var X_JUMBO_VIEW_TYPE_HEADER_PROP_NAME = "x-required-content-type";

	/**
	 * Error logging
	 */
	function logError() {
		if (uJumbo.consoleLogging)
			console.error.apply(null, Array.prototype.slice.call(arguments));
	}

	/**
	 * Warn logging
	 */
	function logWarn() {
		if (uJumbo.consoleLogging)
			console.warn.apply(null, Array.prototype.slice.call(arguments));
	}

	/**
	 * FORM serialization
	 * @param form
	 * @return {*}
	 */
	function serialize(form) {
		if (window["serializeFormData"]) return serializeFormData(form);
		alert("Sorry, but your browser is outdated.");
		return {};
	}

	/**
	 *
	 * @param setup
	 * @param data
	 * @returns {Promise}
	 */
	function sendAjax(setup, data) {
		if (data instanceof FormData) {
			setup.data = data;
		} else {
			try {
				setup.data = JSON.stringify(data);
				setup.contentType = "application/json";
			} catch (ex) {
				setup.data = data;
			}
		}

		return uJumbo.ajax(setup);
	}

	var MATCH_FNC_CALL_REGEX = /^([a-zA-Z0-9]*)(\((.*)\))?$/;

	/**
	 * Function matching method name and its arguments
	 * @param {String} fn
	 * @param {Function} cb
	 */
	function getFn(fn, cb) {
		// noinspection JSValidateTypes
		fn = fn.match(MATCH_FNC_CALL_REGEX);

		if (fn !== null) {
			var args = [];
			if (!!fn[3]) {
				args = eval("[" + fn[3] + "]");
			}

			cb(fn[1], args);
		}
	}

	var appContext = {
		cntrls: []
	};

	/**
	 * Save current app state to history
	 */
	function saveState() {
		var state = {
			uJState: true,
			content: {}
		};

		for (var c = appContext.cntrls.length - 1; c >= 0; c++) {
			state.content[c] = appContext.cntrls[c].__getContent();
		}

		history.pushState(state, document.title, window.location.href);
	}

	//endregion

	//region Base Controller

	/**
	 * Base Controller
	 * @constructor
	 */
	var BaseController = function (containerSel) {
		this.container = null;
		this.events = [];
		this.links = [];
		this.forms = [];
		this.snippets = {};

		console.log("BaseController called");

		// store controller in context
		appContext.cntrls.push(this);

		var self = this;

		// back/forward buttons event
		uJumbo.addEvent(window, "popstate", function popsthndlr() {
			var s = history.state;
			console.debug("PopState", s, new Date());

			if (s && s.uJState) {
				// Controller destruction detection
				var i = appContext.cntrls.indexOf(self);
				if (i == -1) {
					uJumbo.removeEvent(window, "popstate", popsthndlr);
					return;
				}
				// Load stored content
				s = s.content[i];
				if (s) {
					s.__procSnip(s);
				}
			} else {
				console.log("[PopState] No uJState");
				//window.location.href = window.location.href;
				//Controller.prototype.loadPage(location.href, false);
			}
		});

		uJumbo.onReady(function () {
			if (!containerSel) {
				logError("You've not specified 'selector' of controller '" + self.constructor.name + "'."
					+ "You must pass selector as argument when calling super().");
				return;
			}

			var container = uJumbo.get(containerSel);

			if (container instanceof NodeList && container.length == 1) {
				container = container[0];
			}

			if (!(container instanceof Node)) {
				logError("Selector of controller '" + self.constructor.name + "' is invalid. No element found.");
				return;
			}

			// Find all elements n container
			var els = container.getElementsByTagName("*");

			// Add container to the collection
			els = Array.prototype.slice.call(els);
			els.unshift(container);

			self.__findAttrs(els);
			self.__regActions();
			//proccess(els, context);

			// Call initialize onready
			if (self["initiate"]) {
				self["initiate"]();
			}
		});
	};

	/**
	 * Load page on given URL
	 * @param {string} href
	 * @param {boolean} [pushToHistory] Should be state stored in history? Default true.
	 */
	BaseController.prototype.loadPage = function (href, pushToHistory) {
		pushToHistory = pushToHistory !== false;

		// TODO: Show loading spinner
		// jEls.content.innerHTML = uJumbo.loadingSpinnerHtml;

		var headers = {};
		headers[X_JUMBO_VIEW_TYPE_HEADER_PROP_NAME] = "text/html"; // Setting this header will result in returned data
		// it'll be rendered partial view

		uJumbo.xhr.get(href, "text/html", headers).then(function(data) {
			console.log(arguments);

			//var data = odata;
			//var title = data.match(/<(?:(?:title)|(?:TITLE)).*?>([\s\S]*?)<\/(?:(?:title)|(?:TITLE))>/);
			//data = data.match(/<(?:(?:body)|(?:BODY)).*?>([\s\S]*?)<\/(?:(?:body)|(?:BODY))>/);
			//
			//if (data !== null) {
			//	if (!pushToHistory) {
			//		title = null;
			//		href = null;
			//	}
			//	proccessPage(data[1], title, href);
			//} else {
			//	if (controller['proccessLoadPage']) {
			//		controller['proccessLoadPage'](odata);
			//	}
			//}
		}).catch(function(err) {
			console.error("Error:", err.message, arguments);
		});
	};

	/**
	 * Odeslání formuláře
	 * @param form
	 */
	BaseController.prototype.sendForm = function (form) {
		//if (form.tagName.toLowerCase() != "form" || !form.action) {
		//	console.log("Data-j-form attribut were set on bad Element or just action miss.");
		//	return;
		//}
		//
		//var self = this;
		//
		//jumbo.xhr.post(form.action, new FormData(form), function(err, data) {
		//	if (err != null) {
		//		console.log("Error:", err.message);
		//		return;
		//	}
		//
		//	if (data.formErrorMessages) {
		//		var erl = data.formErrorMessages.length;
		//
		//		for (var e = 0; e < erl; e++) {
		//			!!jumbo.alert ? jumbo.alert(data.formErrorMessages[e]) : alert(data.formErrorMessages[e]);
		//		}
		//
		//		return;
		//	}
		//
		//	if (data.redirect) {
		//		self.loadPage(data.redirect);
		//		return;
		//	}
		//
		//	if (controller['proccessForm']) {
		//		controller['proccessForm'](data);
		//	}
		//}, "json");
	};


	/**
	 * Return current content of controller container
	 * @private
	 * @returns {String}
	 */
	BaseController.prototype.__getContent = function () {
		return this.container.innerHTML;
	};

	/**
	 * Find all data attrs
	 * @private
	 * @param {NodeList} els
	 */
	BaseController.prototype.__findAttrs = function (els) {
		var ell, dataset;
		for (var el in els) {
			if (els.hasOwnProperty(el)) {
				ell = els[el];
				dataset = ell.dataset;

				if (dataset) {
					for (var ds in dataset) {
						if (ell.dataset.hasOwnProperty(ds) && ds.substr(0, 3) === "jOn") {
							this.events.push({element: ell, event: ds.substr(3), method: dataset[ds]});
						}
					}

					// LINK
					if ("jLink" in dataset) {
						if (!ell.href || ell.tagName !== "A") continue;
						this.links.push(ell);
					}

					// SNIPPET
					if ("jSnippet" in dataset) {
						this.snippets[dataset["jSnippet"]] = ell;
					}

					// FORM
					if ("jForm" in dataset) {
						if (!ell.action || ell.tagName !== "FORM") continue;
						this.forms.push(ell);
					}
				}
			}
		}
	};

	/**
	 * Register all stored events
	 * @private
	 */
	BaseController.prototype.__regActions = function () {
		var item, eln = this.events.length, self = this;

		// Events
		for (var e = 0; e < eln; e++) {
			(function(item) {
				getFn(item.method, function (fnName, args) {
					// Add element to args
					args.push(item.element);
					var ei = args.length;

					uJumbo.addEvent(item.element, item.event, function (e) {
						args[ei - 1] = e || window.event;

						if (!self.prototype[fnName]) {
							console.error("Method", fnName, "doesn't exists in your controller", this.constructor.name);
							return false;
						}

						return self.prototype[fnName].apply(self, args);
					});
				});
			})(this.events[e]);
		}

		// Links
		eln = this.links.length;
		for (e = 0; e < eln; e++) {
			item = this.links[e];
			// item.setAttribute("onclick", "return false;");
			uJumbo.addEvent(item, "click", function (e) {
				(e || window.event).preventDefault();
				self.loadPage(this.href);
			});
		}

		// Forms
		eln = this.forms.length;
		for (e = 0; e < eln; e++) {
			item = this.forms[e];
			// item.setAttribute("onsubmit", "return false;");
			uJumbo.addEvent(item, "submit", function (e) {
				(e || window.event).preventDefault();
				self.sendForm(this);
			});
		}

		this.forms = [];
		this.links = [];
		this.events = [];
	};

	/**
	 *
	 * @param data
	 * @param snippetName
	 * @param save
	 * @private
	 */
	BaseController.prototype.__procSnip = function (data, snippetName, save) {
		var jss = "";

		data.replace(/<script>([\s\S]*?)<\/script>/ig, function (_, match) {
			jss += match;
		});

		var p;

		if (!snippetName) {
			p = this.container;
		} else {
			p = uJumbo.get("[data-j-snippet='" + snippetName + "']", this.container);
			if (!p) {
				logWarn("Snippet", snippetName, "wasn't found.");
				return;
			}
			p = p[0];
		}

		if (save) {
			saveState();
		}

		this.__findAttrs(p.getElementsByTagName("*"));
		this.__regActions();

		eval(jss);
	};

	BaseController.prototype.__destroy = function () {
		// TODO: unbind events from elements
	};

	//endregion

	var __onRdyCbs; // must be undefined

	return {
		consoleLogging: true,

		loadingSpinnerHtml: "<div class='ujumbo-loading-spinner'><div>",

		/**
		 * Return list of elements matched by selector query
		 * @param {String} selector
		 * @param {Document|Element} [parent]
		 * @returns {NodeList}
		 */
		get: function (selector, parent) {
			if (!parent) parent = document;
			return parent.querySelectorAll(selector);
		},

		addEvent: function (el, type, fn) {
			/*if (el.addEventListener) */el.addEventListener(type, fn);
			// else if (el.attachEvent) el.attachEvent("on" + type, fn);
			return el;
		},

		removeEvent: function (el, type, fn) {
			/*if (el.removeEventListener) */el.removeEventListener(type, fn);
			// else if (el.detachEvent) el.detachEvent("on" + type, fn);
			return el;
		},

		isReady: false,

		/**
		 * Register onready (windows onload) handler
		 * @param fn
		 * @param delay
		 */
		onReady: function (fn, delay) {
			var cb = fn;

			if (delay) {
				cb = function (e) {
					e = e || window.event;
					setTimeout(function () {
						fn(e);
					}, delay);
				};
			}

			if (uJumbo.isReady === true) {
				cb();
				return;
			}

			if (!__onRdyCbs) {

				__onRdyCbs = [function () {
					uJumbo.isReady = true;
				}, cb];
				uJumbo.addEvent(window, "load", function (e) {
					e = e || window.event;
					for (var i = 0; i < __onRdyCbs.length; i++) {
						__onRdyCbs[i](e);
					}
				});
			} else {
				__onRdyCbs.push(cb);
			}
		},

		/**
		 * Send asynchronnous XmlHttpRequest
		 * @param {{
		 * 		url,
		 * 		method,
		 * 		[data],
		 * 		[user],
		 * 		[password],
		 * 		[contentType],
		 * 		[responseType],
		 * 		[headers],
		 * 		[timeout]
		 * 	}} data
		 * 	@returns {Promise}
		 */
		ajax: function (data) {
			return new Promise(function(resolve, reject) {
				try {
					if (typeof data != "object" || !data.url || !data.method) {
						logError("Bad input data for uJumbo.ajax()");
						return;
					}

					var xhr = (XMLHttpRequest) ? (new XMLHttpRequest()) : ((new ActiveXObject("Microsoft.XMLHTTP")) || null);

					if (!xhr) {
						logError("Your browser doesn't support XHR!");
						return;
					}

					xhr.open(data.method, data.url, true, data['user'] || "", data['password'] || "");
					xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

					if (data.headers) {
						for (var h in data.headers) {
							if (data.headers.hasOwnProperty(h)) {
								xhr.setRequestHeader(h, data.headers[h]);
							}
						}
					}

					if (data['contentType']) {
						xhr.setRequestHeader("Content-Type", data['contentType']);
					}

					if (data['responseType']) {
						xhr.responseType = data['responseType'];
					}

					var cbCalled = false;

					xhr.onerror = function () {
						if (cbCalled) return;
						cbCalled = true;
						reject({ code: xhr.status, message: "XHR error occurs" }, xhr);
					};

					xhr.onabort = function () {
						if (cbCalled) return;
						cbCalled = true;
						reject({ code: xhr.status, message: "Request was aborted" }, xhr);
					};

					if (typeof data.timeout == "number") {
						xhr.timeout = data.timeout;

						xhr.ontimeout = function () {
							if (cbCalled) return;
							cbCalled = true;
							reject({ code: xhr.status, message: "Request timed out" }, xhr);
						};
					}

					xhr.onreadystatechange = function () {
						if (xhr.readyState == 4) {
							if (xhr.status >= 200 && xhr.status < 300) {
								resolve(xhr.response);
							} else if (xhr.status >= 400 && xhr.status < 600 && !cbCalled) {
								reject({ code: xhr.status, message: "Response with status code " + xhr.status }, xhr);
							}
						}
					};

					xhr.send(data['data'] || null);
				} catch (e) {
					reject(e);
				}
			});
		},

		xhr: {
			/**
			 * Send POST request
			 * @param url
			 * @param data
			 * @param [responseType]
			 * @returns {Promise}
			 */
			post: function (url, data, responseType) {
				return sendAjax({
					url: url,
					method: "POST",
					responseType: responseType
				}, data);
			},


			/**
			 * Send GET request
			 * @param url
			 * @param [responseType]
			 * @param [headers]
			 * @returns {Promise}
			 */
			get: function (url, responseType, headers) {
				return uJumbo.ajax({
					url: url,
					method: "GET",
					responseType: responseType,
					headers: headers
				});
			},


			/**
			 * Send PUT request
			 * @param url
			 * @param data
			 * @param [responseType]
			 * @returns {Promise}
			 */
			put: function (url, data, responseType) {
				return sendAjax({
					url: url,
					method: "PUT",
					responseType: responseType
				}, data);
			},

			/**
			 * Send DELETE request
			 * @param url
			 * @param [responseType]
			 */
			"delete": function (url, responseType) {
				return uJumbo.ajax({
					url: url,
					method: "DELETE",
					responseType: responseType
				});
			},

			/**
			 * Send FORM
			 * @param form
			 * @param callback
			 */
			sendForm: function (form, callback) {
				uJumbo.ajax({
					url: form.action,
					method: "POST",
					//contentType: "multipart/form-data",
					data: window["FormData"] ? (new FormData(form)) : serialize(form),
					callback: callback
				});
			}
		},

		// /**
		//  * Function for creating application controller
		//  * @param container
		//  * @param {Function} Controller
		//  */
		// createController: function (container, Controller) {
		// 	console.log(BaseController); // TODO: Remove
		//
		// 	// For IE compatibility but with ES6 class support, it must be done in try-catch with class keyword
		// 	try {
		//
		// 	} catch (e) {
		//
		// 	}
		// 	var Ctrl = function () {
		// 		console.log("ctrl called");
		// 		// call super()
		// 		BaseController.apply(this, Array.prototype.slice.call(arguments));
		// 		Controller.apply(this, Array.prototype.slice.call(arguments));
		// 	};
		//
		// 	console.log("Ctor", Controller.prototype.constructor);
		//
		// 	// Extends BaseController
		// 	Controller.prototype = Object.create(BaseController.prototype);
		// 	Controller.prototype.constructor = Controller;
		//
		// 	// Extends - it's important to create instance first but call user's constructor onload
		// 	// so extend user class and call his constructor later as __init()
		// 	Ctrl.prototype = Object.create(Controller.prototype);
		// 	Ctrl.prototype.constructor = Controller.prototype.constructor;//Ctrl;
		// 	// Ctrl.prototype.__init = Controller.prototype.constructor;
		//
		// 	console.log(Controller.prototype.constructor);
		//
		// 	// instantiate Controller
		// 	var ctrl = new Ctrl();
		//
		// 	// // If initiate method exists, call it
		// 	// if (ctrl["initiate"]) {
		// 	// 	ctrl["initiate"]();
		// 	// }
		//
		// 	// store controller in context
		// 	appContext.cntrls.push(ctrl);
		//
		// 	// back/forward buttons event
		// 	uJumbo.addEvent(window, "popstate", function popsthndlr() {
		// 		var s = history.state;
		// 		console.debug("PopState", s, new Date());
		//
		// 		if (s && s.uJState) {
		// 			var i = appContext.cntrls.indexOf(ctrl);
		// 			if (i == -1) {
		// 				uJumbo.removeEvent(window, "popstate", popsthndlr);
		// 				return;
		// 			}
		// 			s = s.content[i];
		// 			if (s) {
		// 				s.__procSnip(s);
		// 			}
		// 		} else {
		// 			console.log("[PopState] No uJState");
		// 			//window.location.href = window.location.href;
		// 			//Controller.prototype.loadPage(location.href, false);
		// 		}
		// 	});
		//
		// 	uJumbo.onReady(function () {
		// 		container = uJumbo.get(container);
		//
		// 		if (container instanceof NodeList && container.length == 1) {
		// 			container = container[0];
		// 		}
		//
		// 		if (!(container instanceof Node)) {
		// 			console.error("Argument 'container' is invalid");
		// 			return;
		// 		}
		//
		//
		// 		/** Projdeme container a najdeme si všechny prvky pro nás */
		// 		var els = container.getElementsByTagName("*");
		//
		// 		/** Do elementů přidáme i container samotný*/
		// 		els = Array.prototype.slice.call(els);
		// 		els.unshift(container);
		//
		// 		//proccess(els, context);
		//
		// 		// Call onready received controller
		// 		// ctrl.__init.call(ctrl);
		// 		if (ctrl["initialize"]) {
		// 			ctrl["initialize"]();
		// 		}
		// 	});
		// },

		/**
		 * Controller class which should be inherited
		 */
		Controller: BaseController,

		/**
		 * Destroy controller
		 * @param ctrl
		 */
		destroyController: function (ctrl) {
			ctrl.__destroy();
			appContext.cntrls[appContext.cntrls.indexOf(ctrl)] = null;
		}
	}
})();