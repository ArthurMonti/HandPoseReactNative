

const ClassMapping = {

    getClassString: (index) =>
    {
        console.log(Classes[index])
        if(Classes[index] != undefined)
            return Classes[index]

        return "";
    }

}

const Classes ={
    0 : "Oi",
    1 : "Bom/Boa",
    2 : "Amanha",
    3 : "Dia",
    4 : "Tarde",
    5 : "Tchau",
    6 : "Tudo Bem"
    
}


export {
    ClassMapping
}