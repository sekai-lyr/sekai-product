(function () {
    const form = document.getElementById('focusForm');
    if (!form) {
        return;
    }

    const taskSelect = document.getElementById('focusTask');
    const minuteSelect = document.getElementById('focusMinutes');
    const energySelect = document.getElementById('focusEnergy');
    const noteInput = document.getElementById('focusNote');
    const completeTaskInput = document.getElementById('focusCompleteTask');
    const display = document.getElementById('focusTimerDisplay');
    const message = document.getElementById('focusMessage');
    const startButton = document.getElementById('focusStart');
    const pauseButton = document.getElementById('focusPause');
    const resetButton = document.getElementById('focusReset');
    const recordButton = document.getElementById('focusRecord');

    let timer = null;
    let plannedSeconds = readPlannedSeconds();
    let remainingSeconds = plannedSeconds;
    let elapsedSeconds = 0;

    function readPlannedSeconds() {
        const minutes = Number.parseInt(minuteSelect.value, 10);
        return Number.isFinite(minutes) ? minutes * 60 : 25 * 60;
    }

    function render() {
        const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
        const seconds = Math.max(0, remainingSeconds % 60).toString().padStart(2, '0');
        display.textContent = `${minutes}:${seconds}`;
        display.classList.toggle('running', Boolean(timer));
        display.classList.toggle('finished', remainingSeconds <= 0);
    }

    function stopTimer() {
        if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
        render();
    }

    function tick() {
        if (remainingSeconds <= 0) {
            stopTimer();
            message.textContent = '这一轮冲刺完成，可以记录结果。';
            return;
        }
        remainingSeconds -= 1;
        elapsedSeconds += 1;
        render();
    }

    function resetTimer() {
        stopTimer();
        plannedSeconds = readPlannedSeconds();
        remainingSeconds = plannedSeconds;
        elapsedSeconds = 0;
        message.textContent = '';
        render();
    }

    startButton.addEventListener('click', function () {
        if (timer) {
            return;
        }
        if (remainingSeconds <= 0) {
            resetTimer();
        }
        message.textContent = '';
        timer = window.setInterval(tick, 1000);
        render();
    });

    pauseButton.addEventListener('click', function () {
        stopTimer();
        if (elapsedSeconds > 0 && remainingSeconds > 0) {
            message.textContent = '已暂停，继续时会从当前位置开始。';
        }
    });

    resetButton.addEventListener('click', resetTimer);

    minuteSelect.addEventListener('change', function () {
        if (!timer && elapsedSeconds === 0) {
            resetTimer();
        }
    });

    recordButton.addEventListener('click', function () {
        stopTimer();
        const plannedMinutes = Math.max(5, Math.round(plannedSeconds / 60));
        const actualMinutes = elapsedSeconds > 0
            ? Math.max(1, Math.ceil(elapsedSeconds / 60))
            : plannedMinutes;
        const body = new URLSearchParams();
        if (taskSelect.value) {
            body.set('taskId', taskSelect.value);
        } else {
            body.set('taskTitle', '自由专注');
        }
        body.set('plannedMinutes', String(plannedMinutes));
        body.set('actualMinutes', String(actualMinutes));
        body.set('energyLabel', energySelect.value || '专注');
        body.set('note', noteInput.value || '');
        body.set('completeTask', completeTaskInput.checked ? 'true' : 'false');

        recordButton.disabled = true;
        message.textContent = '正在保存专注记录...';
        window.fetch(form.getAttribute('action') || '/focus/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body
        })
            .then(function (response) { return response.json(); })
            .then(function (result) {
                if (!result.success) {
                    throw new Error(result.message || '保存失败');
                }
                message.textContent = result.message || '专注已记录。';
                window.setTimeout(function () { window.location.reload(); }, 700);
            })
            .catch(function (error) {
                recordButton.disabled = false;
                message.textContent = error.message || '保存失败，请稍后再试。';
            });
    });

    render();
})();
