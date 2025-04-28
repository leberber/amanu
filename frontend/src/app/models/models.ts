export interface User {
    user_id?: number;         // SERIAL PRIMARY KEY (optional for new user creation)
    nom: string;             // VARCHAR(100) NOT NULL
    prenom: string;          // VARCHAR(100) NOT NULL
    email: string;           // VARCHAR(100) NOT NULL UNIQUE
    mobile: string;          // VARCHAR(20) NOT NULL
    address: string;         // VARCHAR(200) NOT NULL
    commune: string;         // VARCHAR(200) NOT NULL
    village: string;         // VARCHAR(200) NOT NULL
    wilaya: string;          // VARCHAR(100) NOT NULL
    profile_picture?: string; // BYTEA (optional, will be base64 encoded when used in frontend)
    password?: string;       // VARCHAR(255) NOT NULL (optional in responses)
    role: string;            // VARCHAR(50) NOT NULL
    createdAt?: Date;        // TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    updatedAt?: Date;        // TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  }

export interface LoginRequest {
    email : string;
    password: string
}