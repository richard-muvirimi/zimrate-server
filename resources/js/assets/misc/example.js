function getRates() {
    var s = document.createElement("script");
    s.src = "%s/api/v1?callback=myFunction";
    document.body.appendChild(s);
}

function myFunction(rates) {
    console.log(rates);
    //remove script tag...
}
