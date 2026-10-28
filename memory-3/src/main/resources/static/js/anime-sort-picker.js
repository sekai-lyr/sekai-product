(() => {
    const select = document.getElementById('anime-sort');
    if (!select) return;
    const picker = select.parentElement;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = 'anime-sort-trigger';
    trigger.className = 'archive-sort-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'anime-sort-options');
    trigger.setAttribute('aria-labelledby', 'anime-sort-label anime-sort-trigger');
    const menu = document.createElement('div');
    menu.id = 'anime-sort-options';
    menu.className = 'archive-sort-options';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', '排序方式');
    menu.hidden = true;
    const options = Array.from(select.options).map(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'archive-sort-option';
        button.setAttribute('role', 'option');
        button.textContent = option.textContent;
        button.addEventListener('click', () => {
            select.value = option.value;
            select.dispatchEvent(new Event('change', {bubbles: true}));
            close(true);
        });
        menu.append(button);
        return button;
    });
    function sync() {
        trigger.textContent = select.selectedOptions[0].textContent;
        options.forEach((button, index) => {
            button.setAttribute('aria-selected', String(index === select.selectedIndex));
            button.tabIndex = index === select.selectedIndex ? 0 : -1;
        });
    }
    function close(focus = false) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (focus) trigger.focus();
    }
    function open() {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        options[select.selectedIndex].focus();
    }
    trigger.addEventListener('click', () => menu.hidden ? open() : close());
    picker.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            close(true);
            event.preventDefault();
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            if (menu.hidden) {
                open();
                return;
            }
            let index = options.indexOf(document.activeElement);
            if (event.key === 'Home') index = 0;
            else if (event.key === 'End') index = options.length - 1;
            else index = (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
            options[index].focus();
        }
    });
    document.addEventListener('click', event => {
        if (!picker.contains(event.target)) close();
    });
    picker.addEventListener('focusout', event => {
        if (!picker.contains(event.relatedTarget)) close();
    });
    const label = document.querySelector('label[for="anime-sort"]');
    label.id = 'anime-sort-label';
    label.htmlFor = trigger.id;
    select.hidden = true;
    picker.append(trigger, menu);
    select.addEventListener('change', sync);
    sync();
})();
