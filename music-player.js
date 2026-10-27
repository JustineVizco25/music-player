const songImage = document.getElementById("song-image");
const songName = document.getElementById("song-name");
const songArtist = document.getElementById("song-artist");
const songSlider = document.getElementById("song-slider");
const playpauseButton = document.getElementById("playpause-song");
const prevSongButton = document.getElementById("prev-song");
const nextSongButton = document.getElementById("next-song");
const shuffleButton = document.getElementById("shuffle-song");
const repeatButton = document.getElementById("repeat-song");
const currentTime = document.getElementById("current-time");
const totalDuration = document.getElementById("total-duration");
const playerStatus = document.getElementById("player-status");
const audio = document.getElementById("audio");

const songs = [
    {
        image: "./song-images/underneath-the-tree.jpeg",
        name: "Underneath the Tree",
        artist: "Kelly Clarkson",
        audio: "./mp3-files/underneath-the-tree.mp3"
    },
    {
        image: "./song-images/all-i-want-for-christmas-is-you.jpeg",
        name: "All I Want For Christmas is You",
        artist: "Mariah Carey",
        audio: "./mp3-files/all-i-want-for-christmas-is-you.mp3"
    },
    {
        image: "./song-images/snowman.jpeg",
        name: "Snowman",
        artist: "Sia",
        audio: "./mp3-files/snowman.mp3"
    },
    {
        image: "./song-images/happy-sm-mallidays.jpeg",
        name: "Happy SM Mallidays",
        artist: "SM Supermalls",
        audio: "./mp3-files/happy-sm-mallidays.mp3"
    },
    {
        image: "./song-images/kampana-ng-simbahan.jpeg",
        name: "Kampana ng Simbahan",
        artist: "Leo Valdez",
        audio: "./mp3-files/kampana-ng-simbahan.mp3"
    }
];

let currentSongIndex = 0;
let repeatSong = false;
let shuffleSong = false;
let playbackHistory = [];
let trackVersion = 0;
let playRequest = 0;

function formatTime(seconds) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
}

function syncPlayButton() {
    const isPlaying = !audio.paused && !audio.ended;
    const label = isPlaying ? "Pause" : "Play";
    playpauseButton.setAttribute("aria-label", label);
    playpauseButton.title = label;
    document.getElementById("play-symbol").toggleAttribute("hidden", isPlaying);
    document.getElementById("pause-symbol").toggleAttribute("hidden", !isPlaying);
}

function updateSliderProgress() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const percent = duration > 0 ? Math.min(100, Math.max(0, audio.currentTime / duration * 100)) : 0;
    songSlider.style.background = `
        linear-gradient(to right, transparent ${percent}%, #333 ${percent}%),
        repeating-linear-gradient(45deg, red, red 12px, white 12px, white 24px)
    `;
    songSlider.setAttribute("aria-valuetext", `${formatTime(audio.currentTime)} of ${formatTime(duration)}`);
}

function moveSlider() {
    songSlider.value = audio.currentTime;
    currentTime.textContent = formatTime(audio.currentTime);
    updateSliderProgress();
}

async function playSong() {
    if (audio.error) {
        playerStatus.textContent = "This track couldn't be loaded. Try another track.";
        syncPlayButton();
        return;
    }
    const version = trackVersion;
    const request = ++playRequest;
    playerStatus.textContent = "";

    try {
        await audio.play();
    } catch (error) {
        // Loading another track can cancel a pending play request normally.
        if (version !== trackVersion || request !== playRequest || error.name === "AbortError") return;
        syncPlayButton();
        if (!audio.error) {
            playerStatus.textContent = "Playback couldn't start. Press Play to try again.";
        }
    }
}

function updateSong(forcePlay = false) {
    const wasPlaying = forcePlay || !audio.paused;
    const song = songs[currentSongIndex];
    trackVersion++;
    playRequest++;
    audio.pause();

    songImage.src = song.image;
    songImage.alt = `${song.name} by ${song.artist}`;
    songName.textContent = song.name;
    songArtist.textContent = song.artist;
    playerStatus.textContent = "";
    songSlider.disabled = true;
    songSlider.max = 0;
    songSlider.value = 0;
    currentTime.textContent = "0:00";
    totalDuration.textContent = "0:00";

    audio.src = song.audio;
    audio.load();
    updateSliderProgress();
    syncPlayButton();
    if (wasPlaying) void playSong();
}

function goToNextSong() {
    if (shuffleSong && songs.length > 1) {
        playbackHistory.push(currentSongIndex);
        // Pick among every other track without retrying random choices.
        const randomIndex = Math.floor(Math.random() * (songs.length - 1));
        currentSongIndex = randomIndex >= currentSongIndex ? randomIndex + 1 : randomIndex;
    } else {
        currentSongIndex = (currentSongIndex + 1) % songs.length;
    }
}

prevSongButton.addEventListener("click", () => {
    if (shuffleSong && playbackHistory.length > 0) {
        currentSongIndex = playbackHistory.pop();
    } else {
        currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    }
    updateSong();
});

nextSongButton.addEventListener("click", () => {
    goToNextSong();
    updateSong();
});

playpauseButton.addEventListener("click", () => {
    if (audio.paused) {
        void playSong();
    } else {
        playRequest++;
        audio.pause();
    }
});

shuffleButton.addEventListener("click", () => {
    shuffleSong = !shuffleSong;
    shuffleButton.classList.toggle("active-toggle", shuffleSong);
    shuffleButton.setAttribute("aria-pressed", String(shuffleSong));
    if (!shuffleSong) playbackHistory = [];
});

repeatButton.addEventListener("click", () => {
    repeatSong = !repeatSong;
    repeatButton.classList.toggle("active-toggle", repeatSong);
    repeatButton.setAttribute("aria-pressed", String(repeatSong));
});

function updateDuration() {
    const canSeek = Number.isFinite(audio.duration) && audio.duration > 0;
    songSlider.max = canSeek ? audio.duration : 0;
    songSlider.disabled = !canSeek;
    totalDuration.textContent = formatTime(audio.duration);
    moveSlider();
}

audio.addEventListener("loadedmetadata", updateDuration);
audio.addEventListener("durationchange", updateDuration);
audio.addEventListener("timeupdate", moveSlider);
audio.addEventListener("play", syncPlayButton);
audio.addEventListener("pause", syncPlayButton);
audio.addEventListener("ended", () => {
    if (repeatSong) {
        audio.currentTime = 0;
        moveSlider();
        void playSong();
    } else {
        goToNextSong();
        updateSong(true);
    }
});

audio.addEventListener("error", () => {
    songSlider.disabled = true;
    songSlider.max = 0;
    songSlider.value = 0;
    currentTime.textContent = "0:00";
    totalDuration.textContent = "0:00";
    updateSliderProgress();
    syncPlayButton();
    playerStatus.textContent = "This track couldn't be loaded. Try another track.";
});

songSlider.addEventListener("input", () => {
    if (!songSlider.disabled && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(audio.duration, Math.max(0, Number(songSlider.value)));
        moveSlider();
    }
});

updateSong();
