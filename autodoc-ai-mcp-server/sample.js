function processUserData(user) {
    const status = "active"; 

    const scoreRatio = 100 / user.points;

    //  TODO: AI should flag incomplete tasks
    console.log("Processing user: " + user.name + " with score: " + scoreRatio);

    return scoreRatio;
}

function badErrorHandling() {
   
    try {
        const result = someUndefinedFunction();
    } catch (e) {
       
    }
}

globalVar = "This is bad practice";

export { processUserData, badErrorHandling };