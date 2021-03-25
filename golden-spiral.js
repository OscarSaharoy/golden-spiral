
// get the container that is transformed for the pan & zoom
const container  = document.querySelector( "#container"  );

// elements that don't cause zooming or panning when tapped on
preventDrag = Array.from( document.querySelectorAll( "input[type=range]" ) );

// ----------- pan & zoom code ------------

// arrays of pointer positions and previous frame's positions
var activePointers   = [];
var pointerPositions = {};

// mean pointer position and that of last frame
var meanPointer     = { x: 0, y: 0 };
var lastMeanPointer = { x: 0, y: 0 };

// spread of pointers and that of last frame
var pointerSpread     = 0;
var lastPointerSpread = 0;

// we need to keep a bool telling us to
// skip a frame when a new pointer is added
var skip1Frame = false;

// get mean and spread of a list of pointer positions
const getMeanPointer = arr => arr.reduce( (acc, val) => ({ x: acc.x + val.x/arr.length, y: acc.y+val.y/arr.length }), {x: 0, y: 0} );
const getPointerSpread = (positions, mean) => positions.reduce( (acc, val) => acc + ((val.x-mean.x)**2 + (val.y-mean.y)**2)**0.5, 0 );

// these control the overall screen zoom and position
var containerScale  = 1;
var containerOffset = { x: 0, y: 0 };

// link all the pointer events
background.addEventListener( "pointerdown", pointerdown );
background.addEventListener( "pointerup",   pointerup   );
background.addEventListener( "pointermove", pointermove );
background.addEventListener( "wheel",       wheel       );

function pointerdown( event ) {
    
    // if the event's target element is in the preventDrag array then return
    if( preventDrag.reduce( (result, elm) => result || elm == event.target, false) ) return;
    
    // otherwise add the pointer to pointerPositions and activePointers
    pointerPositions[event.pointerId] = { x: event.clientX, y: event.clientY };
    activePointers.push( event.pointerId );
    
    // we added a new pointer so skip a frame to prevent
    // a step change in pan position
    skip1Frame = true;
}

function pointermove( event ) {
    
    // if this pointer isn't an active pointer
    // (pointerdown occured over a preventDrag element)
    // then do nothing
    if( !activePointers.includes(event.pointerId) ) return;
    
    // keep track of the pointer pos
    pointerPositions[event.pointerId] = { x: event.clientX, y: event.clientY };
}

function pointerup( event ) {
    
    // remove the pointer from active pointers and pointerPositions
    // (does nothing if it wasnt in them)
    activePointers = activePointers.filter( id => id != event.pointerId );
    delete pointerPositions[event.pointerId];
    
    // we lost a pointer so skip a frame to prevent
    // a step change in pan position
    skip1Frame = true;
}

// pan/zoom loop
( function panAndZoomScreen() {
    
    // call again next frame
    requestAnimationFrame( panAndZoomScreen );
    
    // if theres no active pointers do nothing
    if( !activePointers.length ) return;
    
    // get the mean pointer and spread
    const pointers = Object.values( pointerPositions );
    meanPointer    = getMeanPointer( pointers );
    pointerSpread  = getPointerSpread( pointers, meanPointer );
    
    // we have to skip a frame when we change number of
    // pointers to avoid a jump
    if( !skip1Frame ) {
        
        // shift the container by the pointer movement
        containerOffset.x += meanPointer.x - lastMeanPointer.x;
        containerOffset.y += meanPointer.y - lastMeanPointer.y;
        
        wheel( { clientX: meanPointer.x,
                 clientY: meanPointer.y,
                 deltaY: (lastPointerSpread - pointerSpread) * 2.7 } );
    }
    
    // update the vars to prepare for the next frame
    lastMeanPointer   = meanPointer;
    lastPointerSpread = pointerSpread;
    skip1Frame        = false;
    
    // update the container's transform
    updateContainerTransform();

} )();

function wheel( event ) {
    
    // prevent browser from doing anything
    event.preventDefault?.();
    
    // adjust the zoom level and update the container
    const zoomAmount = event.deltaY / 600;
    
    // find the centre of the container so we can find the offset of 
    // the pointer and make sure it stays in the same place relative to the container
    var containerBBox = container.getBoundingClientRect();
    centreX = containerBBox.left + containerBBox.width /2;
    centreY = containerBBox.top  + containerBBox.height/2;
    
    // shift the container so that the pointer stays in the same place relative to it
    containerOffset.x += zoomAmount * (event.clientX - centreX);
    containerOffset.y += zoomAmount * (event.clientY - centreY);
    
    // zoom and update the container
    containerScale *= 1 - zoomAmount;
    updateContainerTransform();
}

function updateContainerTransform() {
    
    // set the transform of the container to account for its scale and offset
    container.style.transform = `translateX( ${containerOffset.x}px ) translateY( ${containerOffset.y}px ) scale( ${containerScale} )`;
}

// ----------- end of pan & zoom code ------------

// fit the container div to the screen
var containerBBox = container.getBoundingClientRect();

containerScale = Math.min( 1,
                           window.innerHeight / containerBBox.height * 0.9,
                           window.innerWidth  / containerBBox.width * 0.9 );

updateContainerTransform();


class Slider {
    
    constructor( sliderId, numberId = null) {
        
        // get the slider and throw an error if it wasn't found
        this.slider = document.getElementById( sliderId );
        if( !this.slider ) throw `LogSlider instatiated with invalid slider id: "${sliderId}"`;
        
        // get the number and throw an error if it wasn't found
        this.number = numberId ? document.getElementById( numberId ) : null;
        if( numberId && !this.number ) throw `LogSlider instatiated with invalid number id: "${numberId}"`;
        
        // add a method to get the slider's value
        this.getValue = () => +this.slider.value;
        this.value = 0;
        
        this.onSliderChange = () => this.value = this.number.innerHTML = this.getValue();
        this.onSliderChange();
        
        // connect the callback to be called when the slider is changed
        this.slider.addEventListener( "input", () => this.onSliderChange() );
        
        // map this.addEventListener onto the slider
        this.addEventListener = (...args) => this.slider.addEventListener(...args);
        
        // decimal places of the slider
        this.decimalPlaces = this.slider.step.split(".")[1]?.length || 0;
        
        // forces a value into the slider (self.value may not equal self.slider.value due to slider step not being small enough)
        this.forceValue = newValue => {
            
            this.slider.value = newValue;
            this.value = newValue;
            this.number.innerHTML = +newValue.toFixed(this.decimalPlaces);
        };
    }
}

class LogSlider extends Slider {
    
    constructor( sliderId, numberId = null) {
        
        super( sliderId, numberId );
        
        // cache the initial value of the slider
        const initialValue = this.value;
        
        // setup min and max values from the slider
        this.max = this.slider.max;
        this.min = this.slider.min;
        
        // add a method to get the slider's value adjusted for log
        this.getValue = () => Math.exp( this.slider.value );
        
        // make the slider step small as log space is much smaller than actual space
        this.slider.setAttribute( "step", "0.00001" );
        
        // map the slider to log space
        this.slider.max = Math.log(this.max);
        this.slider.min = Math.log(this.min);
   
        this.round = (x, n) => x > 1 ? Math.round(x) : +x.toPrecision(n);
        
        this.onSliderChange = () => {
            
            this.value = this.getValue();
            this.number.innerHTML = this.round( this.value, 2 );
        };
        
        // forces a value into the slider (self.value may not equal self.slider.value due to slider step not being small enough)
        this.forceValue = newValue => {
            
            this.slider.value = Math.log(newValue);
            this.value = newValue;
            this.number.innerHTML = this.round(newValue);
        };
        
        // map the initial slider value into log space
        this.slider.value = Math.log( initialValue );
    }
}


// getting golden ratio and angle
const phi         = ( 1 + 5**0.5 ) / 2;
const goldenAngle = 2 * Math.PI * ( 1 - 1/phi );

// get the svg element and sliders
const spiralSVG    = document.querySelector( "#spiral-svg" );
const pointsSlider = new LogSlider("points-slider", "points-number");
const angleSlider  = new Slider("angle-slider", "angle-number");

// start the angle at the golden ratio
angleSlider.forceValue( goldenAngle );

function makeCircle( r, theta ) {
    
    // calculate position of circle
    const x =  r * Math.cos(theta);
    const y = -r * Math.sin(theta);
    
    // create circle svg element with correct attributes
    const circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
    circle.setAttribute("cx", x     );
    circle.setAttribute("cy", y     );
    circle.setAttribute("r",  "0.015");
    
    return circle;
}

function makeCircles( radius, angleInc ) {
    
    // get rid of all the old circles
    spiralSVG.innerHTML = "";
    
    // empty circles array to append to DOM
    circles = [];
    
    // number of points is just the floor of the radius of the disc
    const nPoints = Math.floor(radius);

    // make all the circles
    for(var i=1; i<=nPoints; ++i) {
        
        // dont draw a circle at the origin unless its the only one
        if( nPoints > 1 && !(radius-i) ) continue;
        
        circles.push( makeCircle( (radius-i) ** 0.5 / 32, i * angleInc ) );    
    }

    // put the circles onto the DOM
    spiralSVG.append(...circles);
    
    // adjust the scale of the SVG element to fit the circles
    spiralSVG.style.transform = `scale( ${ 32 / radius ** 0.5 } )`;
}

// the button with a phi on that sets the angle to the golden angle
const phiButton = document.getElementById("phi-button");

// when the phi button is pressed, set the slider to the golden angle and redraw
phiButton.onpointerdown = () => { angleSlider.forceValue( goldenAngle ); redraw(); };

// the two arrow buttons in the lower left
const leftAnimateButton  = document.querySelector("#animate-buttons #animate-left" );
const rightAnimateButton = document.querySelector("#animate-buttons #animate-right");

// vars to control the animation
var animatingUp   = false;
var animatingDown = false;
var angularVelocity = 0;

function leftButtonDown() {
    
    // boolean conditions for if we are animating up or down
    animatingDown = !animatingUp;
    animatingUp  &= false;
    
    // angular velocity is just the number of arrows that was on the button
    angularVelocity = -leftAnimateButton.className.baseVal.substr(-1);
    
    // set the button to the next class to get another arrow
    const leftClassNumber = (-angularVelocity) % 3 + 1;
    leftAnimateButton.setAttribute(  "class", `animate-${leftClassNumber}` );
    
    // set the other button to normal or pause as needed 
    rightAnimateButton.setAttribute( "class", animatingDown ? "animate-0" : "animate-1" );
}

function rightButtonDown() {
    
    // boolean conditions for if we are animating up or down
    animatingUp    = !animatingDown;
    animatingDown &= false;
    
    // angular velocity is just the number of arrows that was on the button
    angularVelocity = +rightAnimateButton.className.baseVal.substr(-1);
    
    // set the button to the next class to get another arrow
    const rightClassNumber = angularVelocity % 3 + 1;
    rightAnimateButton.setAttribute( "class", `animate-${rightClassNumber}` );
    
    // set the other button to normal or pause as needed 
    leftAnimateButton.setAttribute(  "class", animatingUp ? "animate-0" : "animate-1" );
}

// link the two buttons to their callbacks
leftAnimateButton.onpointerdown  = leftButtonDown;
rightAnimateButton.onpointerdown = rightButtonDown;

// function which we can call to redraw the dots
const redraw = () => makeCircles( pointsSlider.value, angleSlider.value );

// if either of the sliders is moved then redraw
pointsSlider.addEventListener( "input", redraw );
angleSlider.addEventListener(  "input", redraw );

// animate the first few circles
( function animateCircles(t) {
    
    // map animation time to disc radius - exponential increase then parabolic slowdown
    const radius = t < 13.086 ? 1.5 ** t : 300.01 - 16.9*(t-15.5) ** 2;
    
    // only animate up to 300 circles
    if( radius >= 300 ) return;
    
    // set the points slider to match the animated radius and then redraw
    pointsSlider.forceValue(radius);
    redraw();
    
    // call function again with slightly larger radius
    requestAnimationFrame( () => animateCircles(t+=0.03) );
    
} )(-0.2);

// proper modulo function
const properMod = (n, k) => ( (n % k) + k ) % k;

// animation loop for animating the angleIncrement
( function animateAngle() {
    
    // call function again next frame
    requestAnimationFrame( () => animateAngle() );
    
    // only do something if angularVelocity is nonzero
    if( !angularVelocity ) return;
    
    // calculate angleDelta as increasing exponentially with angularVelocity
    const angleDelta = 10 ** Math.abs(angularVelocity) / 1e+6 * Math.sign(angularVelocity);
    const currentAngleInc = angleSlider.value;
    
    // increase the angle slider's position by angleDelta and redraw the 
    angleSlider.forceValue( properMod(currentAngleInc + angleDelta, 6.28319) );
    makeCircles( pointsSlider.value, angleSlider.value );
    
} )();