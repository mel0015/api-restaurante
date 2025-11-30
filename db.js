const mysql = require ('mysql2');

const connection = mysql.createConnection(
    {
        host: 'localhost',
        user: 'root',
        password: 'root',
        database: 'db_restaurante'
}
);

connection.connect((err)=>{
    if(err){
        console.log("error conectando a mysql: ", err)
        return;
    }
    console.log("Conexion exitosa a MySql");
});

module.exports = connection;