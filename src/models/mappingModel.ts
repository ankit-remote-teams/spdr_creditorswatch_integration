import { Schema, model, Document } from 'mongoose';

// Define an interface representing the document structure
interface IMapping extends Document {
    simproId: string;
    creditorsWatchId: string;
    dataType: 'invoice' | 'creditNote' | 'contacts';
    lastSyncedAt: Date;
    status: 'pending' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}

// Define the Mongoose schema
const MappingSchema = new Schema<IMapping>(
    {
        simproId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        creditorsWatchId: {
            type: String,
            required: true,
            unique: true,
        },
        dataType: {
            type: String,
            enum: ['invoice', 'creditNote', 'contacts'], 
            required: true,
        },
        lastSyncedAt: {
            type: Date,
            default: Date.now,
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending',
        },
    },
    { timestamps: true }
);

// Create and export the Mongoose model
const Mapping = model<IMapping>('Mapping', MappingSchema);

export default Mapping;
