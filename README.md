# μJumbo
JavaScript micro-framework for SPA created as support for JumboJS the Node.js MVC framework.

## uJumbo Object
```typescript
declare interface uJumbo {
	consoleLogging: boolean;
	debug: boolean;

	/**
	 * If TRUE, then all elements will be processed automatically, except elements with data-js-prevent
	 * If FALSE, then you must mark all wanted elements with data-j attributes
	 */
	preventMode: boolean,

	/**
	 * Return list of elements matched by selector query
	 * @param {String} selector
	 * @param {Document|Element} [parent]
	 * @returns {NodeList}
	 */
	get(selector, parent): NodeList;

	addEvent(el, type, fn);
	removeEvent(el, type, fn);
	
	/**
	 * Register onready (windows onload) handler
	 * @param fn
	 * @param delay
	 */
	onReady(fn, delay);

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
	ajax(data): Promise;

	xhr: {
		/**
		 * Send POST request
		 * @param url
		 * @param data
		 * @param [responseType]
		 * @returns {Promise}
		 */
		post(url, data, responseType): Promise;


		/**
		 * Send GET request
		 * @param url
		 * @param [responseType]
		 * @param [headers]
		 * @returns {Promise}
		 */
		get(url, responseType, headers): Promise;


		/**
		 * Send PUT request
		 * @param url
		 * @param data
		 * @param [responseType]
		 * @returns {Promise}
		 */
		put(url, data, responseType): Promise

		/**
		 * Send DELETE request
		 * @param url
		 * @param [responseType]
		 */
		delete(url, responseType): Promise;

		/**
		 * Send FORM
		 * @param {HTMLFormElement} form
		 * @param headers
		 */
		sendForm(form, headers): Promise;
	},

	/**
	 * Controller class which should be inherited
	 */
	Controller: BaseController;

	/**
	 * Destroy controller
	 * @param ctrl
	 */
	destroyController(ctrl);
}
```

```typescript
declare class BaseController {
    loadPage(href, pushToHistory);
    sendForm(form);
}
```

## Example Controller
```javascript
(function(scope) {
	if (scope.AppController) return;

	var AppController = scope.AppController = class extends uJumbo.Controller {
		constructor() {
			super("body"); // Context selector
		}

		onInit() {
			console.log("Called on app init", arguments);
		}

		onBeforeNavigate(headers) {
			console.log("Called before navigatin", arguments)
			// return false; -> as prevent default
		}

		onNavigate(error, response) {
			if (error) {
				console.error(error);
				alert(error.message);
			}

			console.log("Called after navigation", arguments)
		}

		onPopState(state) {
			console.log("Called on browser BACK", arguments)
		}

		onBeforeFormSubmit(data, headers) {
			console.log("Called before form submit", arguments)
			// return false; -> as prevent default
		}

		onFormSubmit(error, response) {
			if (error) {
				alert(error.message);
			}

			console.log("Called after form response received", arguments)
		}

		myAction(hello) {
			alert(hello);
		}
	};

	scope.appCtrl = new AppController();
})(window);
```

## Example View - event bind
```html
<form>
	<button data-j-onClick="myAction('Hello World')">Say Hello.</button>
</form>
```