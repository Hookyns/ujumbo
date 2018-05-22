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

	var X_JUMBO_VIEW_TYPE_HEADER_PROP_NAME = "X-Required-Content-Type",
		ON_POP_STATE_HANDLER_NAME = "onPopState",
		ON_INIT_HANDLER_NAME = "onInit",
		ON_NAVIGATE_HANDLER_NAME = "onNavigate",
		ON_BEFORE_NAVIGATE_HANDLER_NAME = "onBeforeNavigate",
		ON_FORM_SUBMIT_HANDLER_NAME = "onFormSubmit",
		ON_BEFORE_FORM_SUBMIT_HANDLER_NAME = "onBeforeFormSubmit",
		SCRIPT_SRC_REGEX = /<script[^>]*src=.?([^"']+)/ig;

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
	 * Debug logging
	 */
	function logDebug() {
		if (uJumbo.debug)
			console.debug.apply(null, Array.prototype.slice.call(arguments));
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
	 * Save new app state of all controllers to history
	 * @param path
	 */
	function saveState(path) {
		path = path || location.pathname;

		var state = {
			uJState: true,
			content: {}
		};

		for (var c = appContext.cntrls.length - 1; c >= 0; c--) {
			state.content[c] = appContext.cntrls[c].__getContent();
		}

		history.pushState(state, document.title, path/*window.location.href*/);
	}

	//endregion

	//region Base Controller

	/**
	 * Base Controller
	 * @constructor
	 * @param {string} containerSel
	 * @param {string} snippetName
	 */
	var BaseController = function (containerSel, snippetName) {
		this.container = null;
		this.events = [];
		this.links = [];
		this.forms = [];
		this.snippets = {};
		this.snippetName = snippetName || "content";

		logDebug("BaseController called");

		// store controller in context
		appContext.cntrls.push(this);

		var self = this;

		// back/forward buttons event
		uJumbo.addEvent(window, "popstate", function popsthndlr() {
			var s = history.state;
			logDebug("PopState", s, new Date());

			if (s && s.uJState) {
				// Controller destruction detection
				var i = appContext.cntrls.indexOf(self);
				if (i === -1) {
					uJumbo.removeEvent(window, "popstate", popsthndlr);
					return;
				}

				// Load stored content
				s = s.content[i];

				let prevent = self[ON_POP_STATE_HANDLER_NAME]
					? (self[ON_POP_STATE_HANDLER_NAME](s) === false)
					: false;

				if (!prevent) {
					self.__loadState(s);
				}
			} else {
				logDebug("[PopState] No uJState");
				window.location.reload();
			}
		});

		uJumbo.onReady(function () {
			if (!containerSel) {
				logError("You've not specified 'selector' of controller '" + self.constructor.name + "'."
					+ "You must pass selector as argument when calling super().");
				return;
			}

			var container = uJumbo.get(containerSel);

			if (container instanceof NodeList && container.length === 1) {
				container = container[0];
			}

			if (!(container instanceof Node)) {
				logError("Selector of controller '" + self.constructor.name + "' is invalid. No element found.");
				return;
			}

			self.container = container;

			// Find all elements n container
			var els = container.getElementsByTagName("*");

			// Add container to the collection
			els = Array.prototype.slice.call(els);
			els.unshift(container);

			self.__findAttrs(els);
			self.__regActions();

			// Call initialize onready
			if (self[ON_INIT_HANDLER_NAME]) {
				self[ON_INIT_HANDLER_NAME]();
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
		// this.container.innerHTML = uJumbo.loadingSpinnerHtml;

		var headers = {}, self = this;
		headers[X_JUMBO_VIEW_TYPE_HEADER_PROP_NAME] = "text/html"; // Setting this header will result in returned data
		// it'll be rendered partial view

		if (self[ON_BEFORE_NAVIGATE_HANDLER_NAME]) {
			self[ON_BEFORE_NAVIGATE_HANDLER_NAME](headers);
		}

		// // Save actual state again / rewrite
		// this.__saveState();

		uJumbo.xhr.get(href, undefined, headers).then(function (xhr) {
			if (xhr.redirected) {
				href = xhr.responseURL;
			}
			self._processDSRResponse(xhr.response, href, pushToHistory);
		}).catch(function (error) {
			let prevent = this[ON_NAVIGATE_HANDLER_NAME]
				? (this[ON_NAVIGATE_HANDLER_NAME](error, undefined) === false)
				: false;

			if (!prevent) {
				logError("loadPage failed. ", error);
			}
		});
	};

	/**
	 * Send given form to server
	 * @param form
	 */
	BaseController.prototype.sendForm = function (form) {
		var headers = {}, self = this, data = window["FormData"] ? (new FormData(form)) : serialize(form);
		headers[X_JUMBO_VIEW_TYPE_HEADER_PROP_NAME] = "text/html";

		if (self[ON_BEFORE_FORM_SUBMIT_HANDLER_NAME]) {
			self[ON_BEFORE_FORM_SUBMIT_HANDLER_NAME](data, headers);
		}

		uJumbo.ajax({
			url: form.action,
			method: "POST",
			headers: headers,
			data: data
		}).then(function (xhr) {
			let prevent = self[ON_FORM_SUBMIT_HANDLER_NAME]
				? (self[ON_FORM_SUBMIT_HANDLER_NAME](null, xhr.response, xhr) === false)
				: false;

			if (!prevent) {
				self._processDSRResponse(
					xhr.response,
					xhr.redirected ? xhr.responseURL : form.action,
					true
				);
			}
		}).catch(function (error) {
			let prevent = self[ON_FORM_SUBMIT_HANDLER_NAME]
				? (self[ON_FORM_SUBMIT_HANDLER_NAME](error, error.xhr.response) === false)
				: false;

			if (!prevent) {
				logError("sendForm failed.", error);
			}
		});
	};

	/**
	 * Refresh elements in container.
	 */
	BaseController.prototype.refresh = function () {
		// TODO: Implement; Vytvořeno hlavně kvůli tomu, aby mohl uživatel něco zavolat,
		// že udělal změny s elementy (např přidat nové tlačítko s eventem) a nechat znovu dohledat atributy a registrovat akce
	};

	/**
	 * Save state of this controller
	 * @private
	 */
	BaseController.prototype.__saveState = function (path) {
		path = path || location.pathname;
		var state = history.state;

		if (state == null) { // Save state of all controllers
			saveState(location.pathname);
			return;
		}

		var i = appContext.cntrls.indexOf(this);
		state.content[i] = this.__getContent();

		history.replaceState(state, document.title, path);
	};

	/**
	 * Load given state; default called on window.popstate
	 * @param state
	 * @private
	 */
	BaseController.prototype.__loadState = function (state) {
		if (state) {
			this.container.innerHTML = state;
			this.__procSnip(state);
		}
	};

	/**
	 * Process Doubl-Sided Rendering response
	 * @param response
	 * @param href
	 * @param pushToHistory
	 */
	BaseController.prototype._processDSRResponse = function (response, href, pushToHistory) {
		// TODO: Solve snippet problem; container vs snipet vs content ?
		var content = (uJumbo.get("[data-j-snippet='" + this.snippetName + "']", this.container) || [null])[0];

		if (content) {
			content.innerHTML = response;

			let isReaload = href === location.href;

			if (pushToHistory) {
				saveState(href);
			} else {
				this.__saveState(href);
			}

			// FadeOut effect
			if (!isReaload) {
				content.className = (content.className.replace("j-fade-in", "") + " j-fade-out").trim();
			}

			let prevent = this[ON_NAVIGATE_HANDLER_NAME]
				? (this[ON_NAVIGATE_HANDLER_NAME](null, response) === false)
				: false;

			if (!prevent) {
				this.__procSnip(response, undefined, function () {

					// Fade In effect
					if (!isReaload) {
						setTimeout(function () {
							content.className = (content.className.replace("j-fade-out", "") + " j-fade-in").trim();
						}, 10);
					}
				});
			}
		}


		/* TODO: Opravdu řešit vykreslením celého view na serveru s matchem na daný snippet
		Vracet data ve formátu:
		{
			title: "Titulek stránky"
			html: "html daného snippetu",
			... umožnit na serveru doplnění dalších věcí ...
		}

		Zde umožnit reagovat -> proccessLoadPage; aby si mohl programátor doplněné parametry zase převzít a zpracovat
		*/
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
	 * Find events on element
	 * @param dataset
	 * @param ell
	 * @private
	 */
	BaseController.prototype.__findEvents = function (dataset, ell) {
		for (var ds in dataset) {
			if (dataset.hasOwnProperty(ds) && ds.substr(0, 3) === "jOn") {
				dataset.jInitiated = true;
				this.events.push({element: ell, event: ds.substr(3), method: dataset[ds]});
			}
		}
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

				if (dataset && !dataset.jInitiated) {
					this.__findEvents(dataset, ell);

					// LINK
					if (ell.tagName === "A" && ell.href && (
							"jLink" in dataset
							|| (uJumbo.preventMode && !("jPrevent" in dataset)))
					) {
						// if (!ell.href || ell.tagName !== "A") continue;
						dataset.jInitiated = true;
						this.links.push(ell);
					}

					// SNIPPET
					if ("jSnippet" in dataset) {
						dataset.jInitiated = true;
						this.snippets[dataset["jSnippet"]] = ell;
					}

					// FORM
					if (ell.tagName === "FORM" && ell.action && (
							"jForm" in dataset
							|| (uJumbo.preventMode && !("jPrevent" in dataset)))
					) {
						dataset.jInitiated = true;
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
			(function (item) {
				getFn(item.method, function (fnName, args) {
					// Add element to args
					args.push(item.element);
					var ei = args.length;

					uJumbo.addEvent(item.element, item.event, function (e) {
						args[ei - 1] = e || window.event;

						if (!self[fnName]) {
							console.error("Method", fnName, "doesn't exists in your controller", this.constructor.name);
							return false;
						}

						return self[fnName].apply(self, args);
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
	 * Process snippet, find and run scripts, find fw attrs and register events
	 * @param {string} data Snippet html code
	 * @param {string} [snippetName]
	 * @param callback
	 * @private
	 */
	BaseController.prototype.__procSnip = function (data, snippetName, callback) {
		var jss = "";
		var jsFiles = [];

		data.replace(/<script>([\s\S]*?)<\/script>/ig, function (_, match) {
			jss += match;
		});

		data.replace(SCRIPT_SRC_REGEX, function (_, match) {
			jsFiles.push(match);
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

		var self = this;

		function next() {
			self.__findAttrs(p.getElementsByTagName("*"));
			self.__regActions();

			eval(jss);
			if (callback) callback();
		}

		if (jsFiles.length === 0) {
			return next();
		}

		// Add scripts files
		var before = document.body.firstChild, cnt = jsFiles.length;
		for (var i = 0; i < jsFiles.length; i++) {
			(function () {
				var scrpt = document.createElement("script");
				scrpt.setAttribute("src", jsFiles[i]);
				scrpt.onload = function () {
					if (--cnt === 0) next();
					document.body.removeChild(scrpt);
				};
				document.body.insertBefore(scrpt, before)
			})();
		}
	};

	BaseController.prototype.__destroy = function () {
		// TODO: unbind events from elements
	};

	//endregion

	var __onRdyCbs; // must be undefined

	return {
		consoleLogging: true,

		debug: false,

		loadingSpinnerHtml: "<div class='ujumbo-loading-spinner'><div>",

		/**
		 * If TRUE, then all elements will be processed automatically, except elements with data-js-prevent
		 * If FALSE, then you must mark all wanted elements with data-j attributes
		 */
		preventMode: true,

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
			/*if (el.addEventListener) */
			el.addEventListener(type, fn);
			// else if (el.attachEvent) el.attachEvent("on" + type, fn);
			return el;
		},

		removeEvent: function (el, type, fn) {
			/*if (el.removeEventListener) */
			el.removeEventListener(type, fn);
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
		 *    @returns {Promise}
		 */
		ajax: function (data) {
			return new Promise(function (resolve, reject) {
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
						reject({code: xhr.status, message: "XHR error occurs"}, xhr);
					};

					xhr.onabort = function () {
						if (cbCalled) return;
						cbCalled = true;
						reject({code: xhr.status, message: "Request was aborted"}, xhr);
					};

					if (typeof data.timeout === "number") {
						xhr.timeout = data.timeout;

						xhr.ontimeout = function () {
							if (cbCalled) return;
							cbCalled = true;
							reject({code: xhr.status, message: "Request timed out"}, xhr);
						};
					}

					xhr.onreadystatechange = function () {
						if (xhr.readyState === 4) {
							if (xhr.status >= 200 && xhr.status < 300) {
								if (xhr.responseURL !== data.url) {
									xhr.redirected = true;
								}

								resolve(xhr);
							} else if (xhr.status >= 400 && xhr.status < 600 && !cbCalled) {
								reject({
									code: xhr.status,
									message: "Response with status code " + xhr.status,
									xhr: xhr
								});
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
			 * @param {HTMLFormElement} form
			 * @param headers
			 * @param onRedirect
			 */
			sendForm: function (form, headers, onRedirect) {
				return uJumbo.ajax({
					url: form.action,
					method: "POST",
					headers: headers,
					//contentType: "multipart/form-data",
					data: window["FormData"] ? (new FormData(form)) : serialize(form)
				});
			}
		},

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