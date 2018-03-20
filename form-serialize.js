/*
 * Include this only if you want to support older browsers which not support FormData
 */

/**
 * Will serialize form data into URL query
 * @param form
 * @return {string}
 */
function serializeFormData(form) {
	if (!form || form.tagName != "FORM") return;

	var t, e, i, j, q = [];

	for (i = form.elements.length - 1; i >= 0; i--) {
		e = form.elements[i];

		if (!e.name || e.disabled) continue;

		switch (e.nodeName) {
			case "BUTTON":
			case "INPUT":
				t = e.type;
				if ((t == "checkbox" || t == "radio") && e.checked)
					q.push(e.name + "=" + encodeURIComponent(e.value));
				else if (t != "file")
					q.push(e.name + "=" + encodeURIComponent(e.value));
				break;
			case "TEXTAREA":
				q.push(e.name + "=" + encodeURIComponent(e.value));
				break;
			case "SELECT":
				switch (e.type) {
					case "select-one":
						q.push(e.name + "=" + encodeURIComponent(e.value));
						break;
					case "select-multiple":
						for (j = e.options.length - 1; j >= 0; j--) {
							if (e.options[j].selected) {
								q.push(e.name + "=" + encodeURIComponent(e.options[j].value));
							}
						}
						break;
				}
				break;
		}
	}

	return q.join("&");
}