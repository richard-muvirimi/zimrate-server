/**
 * Get server date and set it to local datetime string
 */
function setDate() {

    let date = document.getElementById("last_checked_date").innerHTML;

    document.getElementById("last_checked_date").innerHTML = new Date(date).toLocaleString();
}