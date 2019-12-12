import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Coverage {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    projectName: string;

    @Column()
    testName: string;

    @Column()
    statements: number;

    @Column()
    conditionals: number;

    @Column()
    methods: number;

    @Column()
    coveredStatements: number;

    @Column()
    coveredConditionals: number;

    @Column()
    coveredMethods: number;

    @CreateDateColumn()
    createdDate: Date;

    @UpdateDateColumn()
    updatedDate: Date;

    public getTotalCoverage(): number {
        return this.coveredStatements + this.coveredMethods + this.coveredConditionals
    }

    public getTotalToCover(): number {
        return this.statements + this.methods + this.conditionals
    }

    public getCoveragePercent() {
        return this.getTotalCoverage()/this.getTotalToCover()
    }
}
