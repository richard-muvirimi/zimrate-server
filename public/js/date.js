/**
 * Get server date and set it to local datetime string
 */
function setDate() {

    let instant = document.getElementById("last_checked_date").getAttribute("data-checked");

    let date = luxon.DateTime.fromSeconds(parseInt(instant));

    document.getElementById("last_checked_date").innerHTML = date.toLocaleString(luxon.DateTime.DATE_HUGE) + " " + date.toLocaleString(luxon.DateTime.TIME_24_WITH_SECONDS);
}