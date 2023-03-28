var Player
var Questions = 1
var numQuestions = 2
var transmitted_blueDots = 0
var transmitted_yellowDots = 0
var socialInfoTypes = [] // There needs to be 5 1s and 5 0s in this array. If the array is empty, it lets participants choose 
var time = 0 // How long have participants spent

function tickClock(){
  time = time + 1;
  setTimeout(function(){
    tickClock();
  }, 1000)
}

function resetTimer() {
  time = 0
}

function determinePlayer(){
    node_id = dallinger.storage.get("my_node_id");
    node_type = dallinger.storage.get("node_type");
    if(node_type == "Drone_node"){
        Player = "A"
    } else {
        Player = "B"
    }    
}

function getInfo() {
  // Get info for node
  dallinger.getReceivedInfos(node_id)
    .done(function (resp) {
        Infos = resp.infos
    })
    .fail(function (rejection) {
      console.log(rejection);
      $('body').html(rejection.html);
    });
};

function extractInfo(){
    // Pull out the needed information for player B
    Contents = JSON.parse(Infos[Questions - 1].contents)
    transmitted_blueDots = Contents.Blue
    transmitted_yellowDots = Contents.Yellow
    A_answer = Contents.Answer
    A_advice = Contents.Advice
    if(Contents.Question != Questions){
        console.log("WRONG QUESTION ABORT ")
    }
    return Promise.resolve();
}

async function continueTrial() {
  if ($('#feedback_div').is(':visible') || $('#Info_div').is(':visible')) {
    $("#feedback_div").hide();
    $("#Info_div").hide();
    $("#Next").show(); 
    $("#Small_header").html("When you are ready to continue, click the button below.");
  } else {
    if (Questions > numQuestions) {
      dallinger.createInfo(node_id, {
        contents: "End",
        info_type: 'Finished'
      }).done(function(resp) {
        dallinger.goToPage('survey')
      });                  
    } else { 
      if (Player == "B") {
        await extractInfo();
      }
      resetTimer();
      $("#Main_header").html("Question " + Questions + " / " + numQuestions);          
      $("#Small_header").hide();
      $("#Next").hide();        
      generateDots(transmitted_blueDots, transmitted_yellowDots);
      presentDisplay();
    }         
  }   
}

function shuffle(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}

function randi(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDots(transmitted_blueDots, transmitted_yellowDots) {
        // Display parameters
        width = 600;
        height = 400;
        if(Player == "A"){
            // generate the array for player A
            blueDots = Math.floor(Math.random() * 11); // Generate a random number of blue dots between 0 and 10.
            yellowDots = 10 - blueDots
            if(blueDots < 10){
                blueDots = blueDots + Math.round(Math.random()) // To allow there to be odd differences. 
            }
            yellowDots = yellowDots + 2 // Note, you must add at least 1. Otherwise, if there are 10 blue dots, there will be 0 yellow dots. 
            blueDots = blueDots + 2            
        } else {
            // Its a player B question, so it must be the same but more difficult
            blueDots = transmitted_blueDots
            yellowDots = transmitted_yellowDots
            yellowDots = yellowDots + 2
            blueDots = blueDots + 2
        }

        excess = blueDots - yellowDots
        numDots = blueDots + yellowDots
        dots = [];
        sizes = [];
        rMin = 30; // The dots' minimum radius.
        rMax = 30;
        horizontalOffset = (window.innerWidth - width) / 2;

        paper = Raphael(horizontalOffset, 200, width, height);

        colors = [];
        colorsRGB = ["#428bca", "#FBB829"];

        for (var i = blueDots - 1; i >= 0; i--) {
            colors.push(0);
        }

        for (var i = yellowDots - 1; i >= 0; i--) {
            colors.push(1);
        }

        colors = shuffle(colors);

        while (dots.length < numDots) {

            // Pick a random location for a new dot.
            r = randi(rMin, rMax);
            x = randi(r, width - r);
            y = randi(r, height - r);

            // Check if there is overlap with any other dots
            pass = true;
            for (var i = dots.length - 1; i >= 0; i--) {
                distance = Math.sqrt(Math.pow(dots[i].attrs.cx - x, 2) + Math.pow(dots[i].attrs.cy - y, 2));
                if (distance < (sizes[i] + r)) {
                    pass = false;
                }
            }

            if (pass) {
                var dot = paper.circle(x, y, r);
                dot.hide();
                // use the appropriate color.
                dot.attr("fill", colorsRGB[colors[dots.length]]); // FBB829
                dot.attr("stroke", "#fff");
                dots.push(dot);
                sizes.push(r);
            }
        }
    }

function presentDisplay (argument) {
    for (var i = dots.length - 1; i >= 0; i--) {
        dots[i].show();
    }
    $("#stimulus_div").show();
    setTimeout(function() {
        for (var i = dots.length - 1; i >= 0; i--) {
            dots[i].hide();
        }

        lock = false;
        paper.clear();
        allowGuess();
    }, 2000);
}

function allowGuess(){
    $("#stimulus_div").hide();
    $("#Small_header").show();
    $("#Small_header").html("How many more blue circles were there than yellow circles? When you are happy with your answer, click the button below.");
    $("#Slider").show();
    $("#Submit_answer").show();
}

function submitAnswer(answer){
    $('#Guessslider').data('ionRangeSlider').reset();
    disableButtons();
    $("#Submit_answer").hide();
    if(Player == "A"){
        adviceDiv(answer);
    } else {
        socialDiv(answer); 
    }
}

function adviceDiv(answer){
    // Show the information for player A
    $("#Advice").html("The advice that player B will see for this question is: 0");
    $("#Submit_advice").show();
    $("#feedback_div").show(); 
    $("#Small_header").html("What advice would you like to leave for player B?");
    $("#Answer").html("You answered: " + answer);
    createOutcomeInfo(answer);
    Answer = answer;
}
 
function socialDiv(answer){
    // Show the information for player B
    resps = {
        "Question" : Questions,
        "Answer" : answer
    }
    dallinger.createInfo(node_id,{
        contents: JSON.stringify(resps),
        info_type: 'First_guess',
        property1: JSON.stringify({
            "time_spent" : time
        })
    })
    resetTimer();     
    $("#Info_div").show();
    $("#Submit_revision").show();      
    $("#Small_header").html("You may now amend your guess if you wish.");
    $("#first_guess").html("Your first answer was: " + answer);  
    SocialInfo = socialInfoTypes.splice(Math.floor(Math.random() * socialInfoTypes.length), 1)[0];
    if(SocialInfo == 0){
        displayAdvice();
    } else if (SocialInfo == 1) {
        displaySpy();
    } else {
        // The array is empty, so the participant can choose
        displayChoice(); 
    }
} 

function displayAdvice(){
    $("#button_div").hide();    
    $("#extra_info").hide();
    $("#Social_info").html("<strong>The advice</strong> player A left for this question was: " + A_advice);
    resps = {
        "Question" : Questions,
        "Type" : "Advice",
        "Content" : A_advice
    }
    dallinger.createInfo(node_id,{
        contents: JSON.stringify(resps),
        info_type: 'Social_info'
    })      
}

function displaySpy(){
    $("#button_div").hide();
    $("#extra_info").hide();
    $("#Social_info").html("<strong>You spied</strong> on player A and the answer they selected for this question was: " + A_answer);
    resps = {
        "Question" : Questions,
        "Type" : "Spied",
        "Content" : A_answer
    }
    dallinger.createInfo(node_id,{
        contents: JSON.stringify(resps),
        info_type: 'Social_info'
    })    
}

function displayNothing(){
    $("#button_div").hide();
    $("#extra_info").hide();
    $("#Social_info").html("");
    resps = {
        "Question" : Questions,
        "Type" : "Nothing",
        "Content" : "NA"
    }
    dallinger.createInfo(node_id,{
        contents: JSON.stringify(resps),
        info_type: 'Social_info'
    })    
}

function displayChoice(){
    $("#extra_info").show();
    $("#button_div").show();
}

function submitAdvice(advice){
    // Only runs for player A
    $('#Guessslider').data('ionRangeSlider').reset();
    Advice = advice
    disableButtons();
    createJSONInfo();
    $("#Slider").hide();
    $("#Submit_advice").hide();
    continueTrial(); 
    Questions = Questions + 1
}

function submitRevision(revision){
    $('#Guessslider').data('ionRangeSlider').reset();
    $("#button_div").hide();
    disableButtons();
    // Only runs for player B
    resps = {
        "Question" : Questions,
        "Answer" : revision
    };
    dallinger.createInfo(node_id,{
        contents: JSON.stringify(resps),
        info_type: 'Second_guess',
        property1: JSON.stringify({
            "time_spent" : time
        })
    }).done(function(resp){
        resetTimer();
        createOutcomeInfo(revision);
        $("#Social_info ").html("");        
        $("#Slider").hide();
        $("#Submit_revision").hide();
        continueTrial(); 
        Questions = Questions + 1;    
    });     
}

function createOutcomeInfo(finalAnswer){
    if(Math.abs(finalAnswer - excess) <= 1){
        Outcome = "Correct";
    } else {
        Outcome = "Incorrect";
    }
    dallinger.createInfo(node_id,{
        contents: Outcome,
        info_type: 'Answer_Info'
    })   
}

function createJSONInfo(){
    // Create the large JSON info for player B
    resps = {
        "Question" : Questions ,
        "Blue" : blueDots,
        "Yellow" : yellowDots,
        "Answer" : Answer , 
        "Advice" : Advice
    };
  resps = JSON.stringify(resps);
  dallinger.createInfo(node_id, {
    contents: resps,
    info_type: 'JSON_Info',
    property1: JSON.stringify({
        "time_spent" : time
    })
  }).done(function(resp){
    resetTimer();
  }); 
}

function updatePoints(value) {
  // Code for slider to update text displayed
  value = parseInt(value);
  $("#Advice").html("The advice that player B will see for this question is: " + value);
}

function disableButtons(){
    $('#Submit_answer').prop('disabled', true); 
    $('#Submit_advice').prop('disabled', true); 
    $('#Submit_revision').prop('disabled', true); 
}

function enableButtons(){
    $('#Submit_answer').prop('disabled', false);
    $('#Submit_advice').prop('disabled', false);
    $('#Submit_revision').prop('disabled', false);      
}