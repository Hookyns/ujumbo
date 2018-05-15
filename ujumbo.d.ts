declare global {
    module uJumbo {
        class Controller {
            constructor(containerSelector: string);
            loadPage(href: string, pushToHistory: boolean = true);
            sendForm(form: HTMLFormElement);
        }
    }
}